from sqlalchemy import text
from flask import Flask, request, jsonify, render_template
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

# 【手术 2：在此处配置 JWT 密钥并初始化】
# 请将 'Your_Super_Secret_Key_Here' 替换成任意一段复杂的乱码，作为你服务器端签发 Token 的唯一玉玺
app.config['JWT_SECRET_KEY'] = 'Your_Super_Secret_Key_Here' 
jwt = JWTManager(app)

db = SQLAlchemy(app)

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

# ================= 接口路由 =================

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

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    desc = db.Column(db.Text)
    # 建立与 Module 的一对多关联，删除项目时级联删除模块
    modules = db.relationship('Module', backref='project', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'desc': self.desc,
            'modules': [m.to_dict() for m in self.modules]
        }

class Module(db.Model):
    __tablename__ = 'modules'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    
    def to_dict(self):
        return {'id': self.id, 'name': self.name}

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

    def to_dict(self):
        return {
            'id': self.id, 'projectId': self.project_id, 'projectName': self.project_name,
            'moduleId': self.module_id, 'moduleName': self.module_name,
            'point': self.point, 'level': self.level, 'precondition': self.precondition,
            'steps': self.steps, 'expected': self.expected, 'remark': self.remark,
            'creator': self.creator, 'executor': self.executor,
            'assignedBy': self.assigned_by, 'status': self.status,
            # 【本次新增】：把时间转换成 2024-03-20 的格式传给前端
            'createTime': self.create_time.strftime('%Y-%m-%d') if self.create_time else ''
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

# 3. 模块的增与删
@app.route('/api/module', methods=['POST'])
def add_module():
    data = request.json
    try:
        # 【关键修复】：强制将前端传来的 projectId 转换为整数
        proj_id = int(data.get('projectId'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "无效的项目ID"}), 400
        
    name = data.get('name')
    new_mod = Module(project_id=proj_id, name=name)
    db.session.add(new_mod)
    db.session.commit()
    return jsonify({"success": True})

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
            tc = TestCase(
                project_id=int(item.get('projectId')),
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
                status='待测试'
            )
            cases_to_add.append(tc)
        except (TypeError, ValueError):
            continue # 忽略格式错误的数据
            
    if cases_to_add:
        db.session.bulk_save_objects(cases_to_add) # 高效批量插入
        db.session.commit()
        
    return jsonify({"success": True, "count": len(cases_to_add)})

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
@app.route('/api/testcase/batch', methods=['POST'])
def batch_delete_testcases():
    data = request.json
    case_ids = data.get('ids', [])
    if case_ids:
        # 批量删除传过来的ID列表
        TestCase.query.filter(TestCase.id.in_(case_ids)).delete(synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

# 7. 批量分配执行人
@app.route('/api/testcase/assign', methods=['POST'])
def assign_testcases():
    data = request.json
    case_ids = data.get('ids', [])
    executor = data.get('executor')
    assigned_by = data.get('assignedBy')
    
    if case_ids:
        TestCase.query.filter(TestCase.id.in_(case_ids)).update({
            'executor': executor,
            'assigned_by': assigned_by
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

# ================= 托管前端单文件页面 =================
@app.route('/')
def serve_index():
    return render_template('index.html')

if __name__ == '__main__':
    # host='0.0.0.0' 表示允许任何设备通过你的局域网 IP 访问
    app.run(host='0.0.0.0', port=5000, debug=True)