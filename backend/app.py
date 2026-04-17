from sqlalchemy import text
from flask import Flask, request, jsonify, render_template
import json # 【新增：用于解析修正数据的 JSON 格式】
from datetime import timedelta
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
# 【手术 1：在此处增加这行导入】
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity

app = Flask(__name__)
CORS(app)

# ================= 数据库配置 =================
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:Hgq920221??@127.0.0.1:3306/qa_testhub'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 【本次新增：解决 WinError 10055 缓冲区不足的终极连接池配置】
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,          # 常驻连接数（留10个门随时待命）
    'pool_recycle': 60,       # 60秒强制回收一次连接（极其关键，释放死连接）
    'pool_timeout': 30,       # 排队等连接的超时时间
    'max_overflow': 15        # 爆满时允许额外临时插队的最大连接数
}

# 【手术 2：在此处配置 JWT 密钥并初始化】
# 请将 'Your_Super_Secret_Key_Here' 替换成任意一段复杂的乱码，作为你服务器端签发 Token 的唯一玉玺
app.config['JWT_SECRET_KEY'] = 'Your_Super_Secret_Key_Here'
# 【新增：设置通行证有效期为 30 分钟】
# 这意味着用户登录 120分钟后，通行证会自动失效
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=120)
jwt = JWTManager(app)

db = SQLAlchemy(app)

# ================= 新增：消息机制模型定义 =================
class SysMessage(db.Model):
    __tablename__ = 'sys_messages'
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(50), nullable=False)
    sender_cn = db.Column(db.String(50))
    target_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.String(50), nullable=False)
    old_name = db.Column(db.String(100))
    new_name = db.Column(db.String(100), nullable=False)

    # 【必须补上这行：用于存储用例修正内容的长文本】
    correction_payload = db.Column(db.Text)

    status = db.Column(db.String(20), default='pending')
    create_time = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id, 'sender': self.sender, 'senderCn': self.sender_cn,
            'targetType': self.target_type, 'targetId': self.target_id,
            'oldName': self.old_name, 'newName': self.new_name,
            'correctionPayload': self.correction_payload, # 【必须补上这行：把数据发回前端】
            'status': self.status,
            'createTime': self.create_time.strftime('%Y-%m-%d %H:%M:%S') if self.create_time else ''
        }

# ================= 新增：消息机制 API 接口 =================
@app.route('/api/message', methods=['POST'])
@jwt_required()
def create_message():
    data = request.json
    current_username = get_jwt_identity()
    msg = SysMessage(
        sender=current_username,
        sender_cn=data.get('senderCn', current_username),
        target_type=data.get('targetType'),
        target_id=str(data.get('targetId')),
        old_name=data.get('oldName', ''),
        new_name=data.get('newName', ''),
        correction_payload=data.get('correctionPayload', '') # 【必须补上这行：接收前端传来的数据】
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/message/list', methods=['GET'])
@jwt_required()
def get_messages():
    current_username = get_jwt_identity()
    user = User.query.filter_by(username=current_username).first()
    if user and user.role in ['admin', 'superadmin']:
        msgs = SysMessage.query.order_by(SysMessage.id.desc()).all()
    else:
        msgs = SysMessage.query.filter_by(sender=current_username).order_by(SysMessage.id.desc()).all()
    return jsonify({"success": True, "messages": [m.to_dict() for m in msgs]})

@app.route('/api/message/<int:msg_id>/handle', methods=['PUT'])
@jwt_required()
def handle_message(msg_id):
    current_username = get_jwt_identity()
    user = User.query.filter_by(username=current_username).first()
    if not user or user.role not in ['admin', 'superadmin']:
        return jsonify({"success": False, "message": "无权操作"}), 403

    data = request.json
    action = data.get('action')
    msg = SysMessage.query.get(msg_id)
    if not msg or msg.status != 'pending':
        return jsonify({"success": False, "message": "消息已处理"}), 400

    if action == 'approve':
        msg.status = 'approved'
        if msg.target_type in ['project', 'review_project']:
            proj = Project.query.get(int(msg.target_id))
            if proj: proj.name = msg.new_name
        elif msg.target_type in ['module', 'review_module']:
            mod = Module.query.get(int(msg.target_id))
            if mod: mod.name = msg.new_name
        # 【必须补上这一段：当管理员同意修正时，把数据覆盖到原用例上】
        elif msg.target_type == 'testcase':
            tc = TestCase.query.get(int(msg.target_id))
            if tc and msg.correction_payload:
                try:
                    import json # 确保顶部引入了 json
                    payload = json.loads(msg.correction_payload)
                    if payload.get('point'): tc.point = payload['point']
                    if payload.get('level'): tc.level = payload['level']
                    if payload.get('precondition'): tc.precondition = payload['precondition']
                    if payload.get('steps'): tc.steps = payload['steps']
                    if payload.get('expected'): tc.expected = payload['expected']
                    if payload.get('remark'): tc.remark = payload['remark']
                except Exception as e:
                    print("解析修正数据失败:", e)

        db.session.commit()
        return jsonify({"success": True, "targetType": msg.target_type, "targetId": msg.target_id, "newName": msg.new_name})

@app.route('/api/init_msg_db', methods=['GET'])
def init_msg_db():
    from sqlalchemy import text
    try:
        # 核心：因为我们增加了新字段，必须先安全地粉碎旧的消息表，再重新建表
        # 这只会清理之前的旧测试消息，绝对不会影响你的任何用例、用户或项目数据！
        db.session.execute(text('DROP TABLE IF EXISTS sys_messages;'))
        db.session.commit()
        db.create_all()
        return jsonify({"success": True, "message": "消息表已完美升级并重建，请继续测试！"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

# ================= 数据模型定义 =================
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    chinese_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='tester')
    avatar = db.Column(db.String(50), default='male')

    # 用于存储自定义头像的 Base64 数据 (大容量文本)
    avatar_data = db.Column(db.Text)

    def to_dict(self):
        # 注意：返回给前端的数据绝对不能包含 password_hash！
        return {
            'id': self.id,
            'username': self.username,
            'chineseName': self.chinese_name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'avatar': self.avatar,
            'avatarData': self.avatar_data
        }

# ================= 页面路由 =================
@app.route('/')
def index():
    # 当用户访问根目录时，返回 index.html
    return render_template('index.html')

# 1. 初始化超级管理员（仅供开发时运行一次使用）
@app.route('/api/init_db', methods=['GET'])
def init_db():
    db.create_all() # 创建表
    # 如果不存在superadmin，则创建
    if not User.query.filter_by(username='superadmin').first():
        hashed_pw = generate_password_hash('123456') # 哈希加密
        super_admin = User(
            username='superadmin', chinese_name='超级管理员',
            email='super@test.com', phone='13800138000',
            password_hash=hashed_pw, role='superadmin', avatar='male'
        )
        db.session.add(super_admin)
        db.session.commit()
        return jsonify({"success": True, "message": "数据库初始化成功，超管账号已创建！"})
    return jsonify({"success": True, "message": "数据库已存在超管，无需重复初始化。"})

# 2. 注册接口
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')

    # 检查用户名是否重复
    if User.query.filter_by(username=username).first():
        return jsonify({"success": False, "message": "该用户名已被占用"}), 400

    # 生成哈希密码，取代明文
    hashed_password = generate_password_hash(data.get('password'))

    new_user = User(
        username=username,
        chinese_name=data.get('chineseName'),
        email=data.get('email'),
        phone=data.get('phone'),
        password_hash=hashed_password,
        role='tester' # 默认注册都是普通测试员
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": True, "message": "注册成功！"})

# 3. 登录接口
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    # check_password_hash 会自动对比前端传来的明文和数据库里的哈希值
    if user and check_password_hash(user.password_hash, password):
        # 【手术 3：密码验证通过后，生成 Token】
        access_token = create_access_token(identity=user.username)
        return jsonify({
            "success": True,
            "message": "登录成功",
            "token": access_token,  # 将生成的 Token 下发给前端
            "user": user.to_dict()
        })
    else:
        return jsonify({"success": False, "message": "用户名或密码错误"}), 401

# 【手术 4：新增 Token 验真接口】
@app.route('/api/user/me', methods=['GET'])
@jwt_required()  # 这个装饰器是核心，它会自动拦截没有 Token 或 Token 失效的请求
def get_current_user():
    # 如果 Token 没问题，提取出里面的用户名
    current_username = get_jwt_identity()
    user = User.query.filter_by(username=current_username).first()
    if user:
        return jsonify({"success": True, "user": user.to_dict()})
    return jsonify({"success": False, "message": "用户状态异常"}), 404

# ================= 数据模型定义  =================

# --- 修改前的代码片段 ---
class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    desc = db.Column(db.Text)
    # 这一行是关键：给项目加一个“仓库是否已删除”的标记，默认为否(False)
    is_repo_deleted = db.Column(db.Boolean, default=False)
    modules = db.relationship('Module', backref='project', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'desc': self.desc,
            # 将这个标记传给前端，让前端决定要不要显示
            'isRepoDeleted': self.is_repo_deleted,
            'modules': [m.to_dict() for m in self.modules]
        }

# 1. 找到 Module 模型进行替换
class Module(db.Model):
    __tablename__ = 'modules'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    # 【核心新增】：True代表是审核页模块，False代表是正式仓库模块
    is_review = db.Column(db.Boolean, default=False)

    # 【本次新增】：补上软删除标记，True代表它已经在用例仓库被隐藏了
    is_repo_deleted = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'is_review': self.is_review,
            # 【本次新增】：将隐藏标记发给前端
            'isRepoDeleted': self.is_repo_deleted
        }

@app.route('/api/module', methods=['POST'])
def add_module():
    data = request.json
    try:
        proj_id_val = data.get('projectId')
        proj_name = data.get('projectName') # 接收前端传来的项目名称
        name = data.get('name')
        is_review_flag = data.get('isReview', False)

        # 逻辑：如果没有项目ID（说明是手填的项目名），先找项目，没有就建
        if not proj_id_val and proj_name:
            proj = Project.query.filter_by(name=proj_name).first()
            if not proj:
                proj = Project(name=proj_name, desc="审核模块自动创建")
                db.session.add(proj)
                db.session.flush()
            proj_id = proj.id
        else:
            proj_id = int(proj_id_val)

        new_mod = Module(project_id=proj_id, name=name, is_review=is_review_flag)
        db.session.add(new_mod)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

class TestCase(db.Model):
    __tablename__ = 'testcases'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, nullable=False)
    project_name = db.Column(db.String(100))
    module_id = db.Column(db.Integer, nullable=False)
    module_name = db.Column(db.String(100))
    point = db.Column(db.String(255), nullable=False)
    level = db.Column(db.String(20))
    precondition = db.Column(db.Text)
    steps = db.Column(db.Text)
    expected = db.Column(db.Text)
    remark = db.Column(db.Text)
    creator = db.Column(db.String(50))
    executor = db.Column(db.String(50))
    assigned_by = db.Column(db.String(50))
    status = db.Column(db.String(20), default='待测试')

    # 【本次新增】：自动获取数据库的时间
    create_time = db.Column(db.DateTime, server_default=db.func.now())
    # 【本次新增】：用于记录点击已完成时的日期
    finish_time = db.Column(db.String(20))

    def to_dict(self):
        return {
            'id': self.id, 'projectId': self.project_id, 'projectName': self.project_name,
            'moduleId': self.module_id, 'moduleName': self.module_name,
            'point': self.point, 'level': self.level, 'precondition': self.precondition,
            'steps': self.steps, 'expected': self.expected, 'remark': self.remark,
            'creator': self.creator, 'executor': self.executor,
            'assignedBy': self.assigned_by, 'status': self.status,
            'createTime': self.create_time.strftime('%y/%m/%d') if self.create_time else '',
            # 下面这行就是我们要修改的地方，注意冒号和末尾的逗号
            'finishTime': self.finish_time if self.finish_time else '',
        }

# ================= 业务 API 接口 =================

# 1. 获取全局完整数据 (用于前端初始化渲染)
# 1. 获取全局完整数据 (用于前端初始化渲染)
@app.route('/api/data', methods=['GET'])
@jwt_required()  # 保护锁保持不动
def get_all_data():
    projects = Project.query.all()
    testcases = TestCase.query.all()
    # 【修复 1：新增这行，去数据库查询所有用户】
    users = User.query.all()

    return jsonify({
        "success": True,
        "projects": [p.to_dict() for p in projects],
        "testcases": [tc.to_dict() for tc in testcases],
        # 【修复 2：新增这行，把用户列表打包发给前端】
        "users": [u.to_dict() for u in users]
    })

# 2. 新增项目 (Create Project)
@app.route('/api/project', methods=['POST'])
def add_project():
    data = request.json
    if Project.query.filter_by(name=data.get('name')).first():
        return jsonify({"success": False, "message": "项目名称已存在"}), 400

    new_proj = Project(name=data.get('name'), desc=data.get('desc'))
    db.session.add(new_proj)
    db.session.commit()
    return jsonify({"success": True, "message": "项目添加成功", "project": new_proj.to_dict()})

# 更新项目名称
@app.route('/api/project/<int:proj_id>', methods=['PUT'])
def update_project(proj_id):
    data = request.json
    new_name = data.get('name')
    if Project.query.filter(Project.name == new_name, Project.id != proj_id).first():
        return jsonify({"success": False, "message": "项目名称已被占用"}), 400
    proj = Project.query.get(proj_id)
    if proj:
        proj.name = new_name
        # 【级联更新】：把属于该项目的所有用例里的 projectName 也同步改掉
        TestCase.query.filter_by(project_id=proj_id).update({'project_name': new_name})
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/api/project/<int:proj_id>', methods=['DELETE'])
def delete_project_api(proj_id):
    try:
        proj = Project.query.get(proj_id)
        if not proj:
            return jsonify({"success": False, "message": "项目不存在"}), 404

        # 1. 物理删除仓库原件：只删掉该项目下“没有分配人”的用例
        modules = Module.query.filter_by(project_id=proj_id).all()
        mod_ids = [m.id for m in modules]
        if mod_ids:
            TestCase.query.filter(
                TestCase.module_id.in_(mod_ids),
                db.or_(TestCase.assigned_by == None, TestCase.assigned_by == '')
            ).delete(synchronize_session=False)

        # 2. 标记项目在仓库中“消失”：不真删记录，只把标记设为 True
        proj.is_repo_deleted = True

        db.session.commit()
        return jsonify({"success": True, "message": "仓库项目已隐藏，任务中心已保留"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 更新模块名称
@app.route('/api/module/<int:mod_id>', methods=['PUT'])
def update_module(mod_id):
    data = request.json
    new_name = data.get('name')
    mod = Module.query.get(mod_id)
    if mod:
        conflict = Module.query.filter(Module.project_id == mod.project_id, Module.name == new_name, Module.id != mod_id).first()
        if conflict:
            return jsonify({"success": False, "message": "该模块名称已存在"}), 400
        mod.name = new_name
        # 【级联更新】：同步修改测试用例表里的 moduleName
        TestCase.query.filter_by(module_id=mod_id).update({'module_name': new_name})
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/api/module/<int:mod_id>', methods=['DELETE'])
def delete_module_api(mod_id):
    try:
        # 1. 【核心隔离】：物理删除仓库原件
        # 【重要修复】：加上 synchronize_session=False，彻底解决第一次点击时数据库会话同步导致的 500 崩溃报错！
        TestCase.query.filter(
            TestCase.module_id == mod_id,
            db.or_(TestCase.assigned_by == None, TestCase.assigned_by == '')
        ).delete(synchronize_session=False)

        # 2. 【核心修复】：将模块打上隐藏标记，不再是死皮赖脸留着
        mod = Module.query.get(mod_id)
        if mod:
            mod.is_repo_deleted = True

        db.session.commit()
        return jsonify({"success": True, "message": "模块已彻底隐藏，任务中心的数据不受影响"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 4. 测试用例的增、改、删
@app.route('/api/testcase', methods=['POST'])
def save_testcase():
    data = request.json
    case_id = data.get('id')

    # 【关键加固1】：确保项目ID和模块ID必须是整数
    try:
        proj_id = int(data.get('projectId'))
        mod_id = int(data.get('moduleId'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "项目或模块ID格式错误，必须为数字"}), 400

    try:
        if case_id and str(case_id).isdigit(): # 编辑更新模式
            tc = TestCase.query.get(int(case_id))
            if tc:
                tc.point = data.get('point')
                tc.level = data.get('level')
                tc.precondition = data.get('precondition')
                tc.steps = data.get('steps')
                tc.expected = data.get('expected')
                tc.remark = data.get('remark')
        else: # 全新增模式
            tc = TestCase(
                project_id=proj_id,
                project_name=data.get('projectName'),
                module_id=mod_id,
                module_name=data.get('moduleName'),
                point=data.get('point'),
                level=data.get('level'),
                precondition=data.get('precondition'),
                steps=data.get('steps'),
                expected=data.get('expected'),
                remark=data.get('remark'),
                creator=data.get('creator', '未知'),
                status='待测试'
            )
            db.session.add(tc)

        # 【关键加固2】：捕获数据库写入异常
        db.session.commit()
        return jsonify({"success": True})

    except Exception as e:
        db.session.rollback() # 发生错误时回滚
        print("数据库保存用例报错:", str(e)) # 在终端打印具体错误
        return jsonify({"success": False, "message": "数据库保存失败: " + str(e)}), 500

# 4.5 批量添加测试用例 (用于 Excel 导入和 AI 生成保存)
@app.route('/api/testcase/batch_add', methods=['POST'])
def batch_add_testcases():
    data = request.json # 期望收到一个字典组成的列表
    if not isinstance(data, list):
        return jsonify({"success": False, "message": "数据格式错误"}), 400

    cases_to_add = []
    for item in data:
        try:
            proj_id = int(item.get('projectId'))

            # 【核心修复 2】：自动唤醒被隐藏/误删的项目
            # 如果用例被移入了一个之前被删除的项目，立刻将其 is_repo_deleted 设为 False 让它重见天日
            proj = Project.query.get(proj_id)
            if proj and proj.is_repo_deleted:
                proj.is_repo_deleted = False

            tc = TestCase(
                project_id=proj_id,
                project_name=item.get('projectName'),
                module_id=int(item.get('moduleId')),
                module_name=item.get('moduleName'),
                point=item.get('point'),
                level=item.get('level', 'P3'),
                precondition=item.get('precondition', ''),
                steps=item.get('steps', ''),
                expected=item.get('expected', ''),
                remark=item.get('remark', ''),
                creator=item.get('creator', '未知'),
                status='待测试',
                # 【核心修复 1】：接收前端传来的分身标记，彻底解决仓库和任务中心数据混淆的问题
                assigned_by=item.get('assignedBy', ''),
                executor=item.get('executor', '')
            )
            cases_to_add.append(tc)
        except (TypeError, ValueError):
            continue # 忽略格式错误的数据

    if cases_to_add:
        db.session.bulk_save_objects(cases_to_add) # 高效批量插入
        db.session.commit()

    return jsonify({"success": True, "count": len(cases_to_add)})

# ---------------------------------------------------------
# 【核心优化】：审核通过接口（自动补全项目、模块，实现物理迁移）
# ---------------------------------------------------------
@app.route('/api/testcase/approve', methods=['POST'])
def approve_testcases():
    data = request.json
    case_ids = data.get('ids', [])

    try:
        for cid in case_ids:
            tc = TestCase.query.get(cid)
            if not tc: continue

            # 1. 查找或创建正式项目
            proj = Project.query.filter_by(name=tc.project_name).first()
            if not proj:
                proj = Project(name=tc.project_name, desc="审核通过自动创建")
                db.session.add(proj)
                db.session.flush() # 拿到新项目的 ID

            # 2. 查找或创建该项目下的正式模块 (is_review=False)
            target_mod = Module.query.filter_by(
                project_id=proj.id,
                name=tc.module_name,
                is_review=False
            ).first()

            if not target_mod:
                target_mod = Module(project_id=proj.id, name=tc.module_name, is_review=False)
                db.session.add(target_mod)
                db.session.flush() # 拿到新模块的 ID

            # 3. 数据迁移：将用例归属到正式 ID 下，并转为正式状态
            tc.project_id = proj.id
            tc.module_id = target_mod.id
            tc.status = '待测试'

        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# 4. 删除测试用例 (Delete TestCase)
@app.route('/api/testcase/<int:case_id>', methods=['DELETE'])
def delete_testcase(case_id):
    tc = TestCase.query.get(case_id)
    if tc:
        db.session.delete(tc)
        db.session.commit()
        return jsonify({"success": True, "message": "删除成功"})
    return jsonify({"success": False, "message": "用例不存在"}), 404

# ================= 进阶用例操作 API =================

# 5. 更新用例状态
@app.route('/api/testcase/<int:case_id>/status', methods=['PUT'])
def update_testcase_status(case_id):
    data = request.json
    tc = TestCase.query.get(case_id)
    if tc:
        tc.status = data.get('status')
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "用例不存在"}), 404

# 6. 批量删除用例
# 【本次新增】：任务中心专用——批量更新字段接口（不删除数据）
@app.route('/api/testcase/batch_update', methods=['POST'])
def batch_update_cases():
    data = request.json
    case_ids = data.get('ids', [])
    updates = data.get('updates', {}) # 比如 {'executor': ''}
    if case_ids and updates:
        TestCase.query.filter(TestCase.id.in_(case_ids)).update(updates, synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

# 【手术点 3】：批量分配/标记完成接口（克隆分身版）
@app.route('/api/testcase/assign', methods=['POST'])
def assign_testcases():
    import datetime
    from datetime import timedelta, timezone

    data = request.json
    case_ids = data.get('ids', [])
    executor = data.get('executor')

    if executor:
        # 场景 A：分配任务给某人 -> 【触发克隆魔法】
        assigned_by = data.get('assignedBy')
        new_task_cases = []
        for cid in case_ids:
            orig = TestCase.query.get(cid)
            if orig:
                # 制造一个一模一样的分身，但赋予它执行人和分配人的身份
                new_tc = TestCase(
                    project_id=orig.project_id, project_name=orig.project_name,
                    module_id=orig.module_id, module_name=orig.module_name,
                    point=orig.point, level=orig.level, precondition=orig.precondition,
                    steps=orig.steps, expected=orig.expected, remark=orig.remark,
                    creator=orig.creator, status='待测试',
                    executor=executor, assigned_by=assigned_by
                )
                new_task_cases.append(new_tc)

        if new_task_cases:
            db.session.bulk_save_objects(new_task_cases)
            db.session.commit()
    else:
        # 场景 B：点击“已完成” -> 更新任务副本的状态
        beijing_now = datetime.datetime.now(timezone(timedelta(hours=8)))
        finish_time = beijing_now.strftime('%y/%m/%d %H:%M:%S')
        if case_ids:
            TestCase.query.filter(TestCase.id.in_(case_ids)).update({
                'finish_time': finish_time,
                'executor': '' # 清空执行人代表完成
            }, synchronize_session=False)
            db.session.commit()

    return jsonify({"success": True})


# ================= 团队与用户管理 API =================

# 8. 添加或编辑团队成员
@app.route('/api/user', methods=['POST'])
def save_user():
    data = request.json
    user_id = data.get('id')

    if user_id: # 编辑模式
        u = User.query.get(user_id)
        if not u: return jsonify({"success": False, "message": "用户不存在"}), 404

        # 检查修改后的用户名是否跟别人撞车
        conflict = User.query.filter(User.username == data.get('username'), User.id != user_id).first()
        if conflict: return jsonify({"success": False, "message": "用户名已被占用"}), 400

        u.chinese_name = data.get('chineseName')
        u.username = data.get('username')
        u.email = data.get('email')
        u.phone = data.get('phone')
        if 'role' in data and data.get('role'): u.role = data.get('role')
        if data.get('password'): # 如果填了新密码就加密覆盖
            u.password_hash = generate_password_hash(data.get('password'))
    else: # 新增模式
        if User.query.filter_by(username=data.get('username')).first():
            return jsonify({"success": False, "message": "用户名已被占用"}), 400

        new_user = User(
            username=data.get('username'),
            chinese_name=data.get('chineseName'),
            email=data.get('email'),
            phone=data.get('phone'),
            role=data.get('role', 'tester'),
            password_hash=generate_password_hash(data.get('password', '123456')),
            avatar='male'
        )
        db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": True})

# 9. 删除团队成员
@app.route('/api/user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    u = User.query.get(user_id)
    if u:
        db.session.delete(u)
        db.session.commit()
    return jsonify({"success": True})

# 10. 修改个人资料与安全密码
@app.route('/api/user/profile', methods=['PUT'])
def update_profile():
    data = request.json
    u = User.query.get(data.get('id'))
    if u:
        u.chinese_name = data.get('chineseName')
        u.phone = data.get('phone')
        u.email = data.get('email')
        u.avatar = data.get('avatar')
        # 【新增逻辑】：如果前端传了自定义图片数据，就保存到数据库
        if 'avatarData' in data:
            u.avatar_data = data.get('avatarData')

        db.session.commit()
        return jsonify({"success": True, "user": u.to_dict()})
    return jsonify({"success": False})

@app.route('/api/user/password', methods=['PUT'])
def update_password():
    data = request.json
    u = User.query.get(data.get('id'))
    # 安全校验：前端传来的旧密码必须跟数据库里的哈希值对得上
    if u and check_password_hash(u.password_hash, data.get('oldPassword')):
        u.password_hash = generate_password_hash(data.get('newPassword'))
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "当前密码验证失败"}), 400

# ================= 核弹级重建用户表接口 =================
@app.route('/api/rebuild_users', methods=['GET'])
def rebuild_users():
    from sqlalchemy import text
    from werkzeug.security import generate_password_hash
    try:
        # 1. 无视一切错误，强行粉碎旧的 users 表
        db.session.execute(text('DROP TABLE IF EXISTS users;'))
        db.session.commit()

        # 2. 重新按照最新代码（包含 avatar_data 大容量字段）建表
        db.create_all()

        # 3. 重新写入超级管理员
        hashed_pw = generate_password_hash('123456')
        super_admin = User(
            username='superadmin',
            chinese_name='超级管理员',
            email='super@test.com',
            phone='13800138000',
            password_hash=hashed_pw,
            role='superadmin',
            avatar='male'
        )
        db.session.add(super_admin)
        db.session.commit()
        return jsonify({"success": True, "message": "太棒了！用户表已完美重建，请回去登录！"})
    except Exception as e:
        return jsonify({"success": False, "message": "重建失败，错误信息: " + str(e)})

@app.route('/api/rebuild_all_v2', methods=['GET'])
def rebuild_v2():
    db.drop_all() # 警告：这会清空所有数据，请确保是开发阶段
    db.create_all()
    return "数据库结构已更新，请重新注册超管"

if __name__ == '__main__':
    with app.app_context():
        from sqlalchemy import text
        # 1. 确保所有基础表都存在
        db.create_all()

        # 2. 自动修补缺少的字段，彻底解决重命名时的 500 报错
        try:
            db.session.execute(text('ALTER TABLE sys_messages ADD COLUMN sender_cn VARCHAR(50);'))
            db.session.commit()
        except:
            db.session.rollback() # 如果字段已有则自动忽略报错，继续执行

        try:
            db.session.execute(text('ALTER TABLE sys_messages ADD COLUMN old_name VARCHAR(100);'))
            db.session.commit()
        except:
            db.session.rollback()

        # 3. 自动唤醒隐藏项目，彻底解决“用例仓库”为空白的问题
        try:
            db.session.execute(text('UPDATE projects SET is_repo_deleted = 0;'))
            db.session.commit()
        except:
            db.session.rollback()

        # ---------- 【请将以下代码插入到此处】 ----------
        # 4. 自动修补模块表，解决模块无法删除的问题
        try:
            db.session.execute(text('ALTER TABLE modules ADD COLUMN is_repo_deleted BOOLEAN DEFAULT 0;'))
            db.session.commit()
        except:
            db.session.rollback() # 如果字段已经存在则自动忽略

        try:
            db.session.execute(text('UPDATE modules SET is_repo_deleted = 0 WHERE is_repo_deleted IS NULL;'))
            db.session.commit()
        except:
            db.session.rollback()
        # -----------------------------------------------

    # host='0.0.0.0' 表示允许任何设备通过你的局域网 IP 访问
    app.run(host='0.0.0.0', port=5000, debug=True)
