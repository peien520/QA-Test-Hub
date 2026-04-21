var STORAGE_KEY='qa_testhub_v12_pro';
// 【新增】：用于性能优化，记录上一次消息的原始数据快照
var lastMessagesSnapshot = '';
var currentUser=null,currentTab='dashboard',currentProject='',currentModule='',currentPage=1,pageSize=15,currentTheme='default',selectedCases=[],currentTaskFilter='myCharge',selectedAvatar='male',generatedCases=[];
// 【新增】：专门记录任务中心里的项目和模块筛选状态
var currentTaskProject = '', currentTaskModule = '';
var taskSelectedCases = []; // 【新增】：专门记录任务中心勾选的用例
var avatarEditState={rawData:'',scale:1,x:0,y:0,minScale:1,isDragging:false,startX:0,startY:0,baseX:0,baseY:0,naturalWidth:0,naturalHeight:0};
// ====== 新增：前后端分离全局数据 ======
var globalData = { projects: [], testcases: [], users: [] };

// ====== 新增：携带 Token 的全局安全请求网关 ======
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('qa_token');
    const headers = options.headers || {};

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    options.headers = headers;

    const response = await fetch(url, options);

    // 核心拦截逻辑：只要后端返回 401，立刻掐断并踢回登录页
    if (response.status === 401) {
        localStorage.removeItem('qa_token');
        localStorage.removeItem('qa_currentUser');

        currentUser = null; // 【新增：彻底清空内存里的用户状态，掐断后续的每5秒轮询】

        showToast('登录状态失效，请重新登录', 'error');

        // 强制隐藏主界面，显示登录页
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        throw new Error('Unauthorized');
    }
    return response;
}

// 新增：从后端拉取最新数据的函数
async function fetchServerData() {
    try {
        const response = await authFetch('/api/data');
        const data = await response.json();
        if (data.success) {
            globalData.projects = data.projects;
            globalData.testcases = data.testcases;
            globalData.users = data.users;
        }
    } catch (e) {
        console.error("从服务器拉取数据失败:", e);
    }
}
var expandedMenu = JSON.parse(localStorage.getItem('qa_expandedMenu') || '{"testcases":true,"tasks":false,"review":false}');
var currentReviewFilter = 'pending';

function showBottomNotification(title, message) {
    var container = document.getElementById('notifyContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifyContainer';
        container.className = 'notify-container';
        document.body.appendChild(container);
    }
    var box = document.createElement('div');
    box.className = 'notify-box';
    box.innerHTML = '<div class="notify-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' + esc(title) + '</div><div class="notify-desc">' + esc(message) + '</div>';
    container.appendChild(box);

    void box.offsetWidth;
    box.classList.add('show');

    setTimeout(function(){
        box.classList.remove('show');
        setTimeout(function(){
            if(box.parentNode === container) container.removeChild(box);
        }, 400);
    }, 6000);
}

var themeOrder=['default','dark','ocean','forest','sunset','rose','violet','amber','mint', 'geekblue'];
var themeMeta={
    default:{name:'默认主题',preview:'linear-gradient(135deg,#007aff,#5856d6)'},
    dark:{name:'深色模式',preview:'linear-gradient(135deg,#1c1c1e,#000000)'},
    ocean:{name:'海洋蓝',preview:'linear-gradient(135deg,#0bc5ea,#3b82f6)'},
    forest:{name:'森林绿',preview:'linear-gradient(135deg,#34d399,#10b981)'},
    sunset:{name:'日落橙',preview:'linear-gradient(135deg,#f97316,#ef4444)'},
    rose:{name:'玫瑰粉',preview:'linear-gradient(135deg,#f43f5e,#e11d48)'},
    violet:{name:'紫罗兰',preview:'linear-gradient(135deg,#8b5cf6,#6366f1)'},
    amber:{name:'琥珀金',preview:'linear-gradient(135deg,#fcd34d,#f59e0b)'},
    mint:{name:'薄荷青',preview:'linear-gradient(135deg,#2dd4bf,#0d9488)'},
    geekblue:{name:'极客深邃蓝',preview:'linear-gradient(135deg,#2f54eb,#1d39c4)'}
};

const svgIcons = {
    dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    casegen: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
    review: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    testcases: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    tasks: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    team: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    permission: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

const taskSubIcons = {
    myCharge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    myCreate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    myAssign: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
    completed: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
};

const reviewSubIcons = {
    pending: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    rejected: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
};

const hierarchyIcons = {
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
};

var columnConfig=[['col-checkbox','勾选'],['col-id','序号'],['col-module','模块'],['col-point','测试点'],['col-level','等级'],['col-precondition','前置条件'],['col-steps','操作步骤'],['col-expected','预期结果'],['col-remark','备注'],['col-creator','创建人'],['col-actions','操作']];

function initGameBG() {
    var canvas = document.getElementById('gameCanvas');
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = window.innerWidth;
    var h = canvas.height = window.innerHeight;
    var particles = [];
    var maxDist = 180;

    for(var i=0; i<50; i++){
        particles.push({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
            r: Math.random() * 2.5 + 1
        });
    }

    function draw() {
        if(document.getElementById('loginPage').style.display === 'none') {
            requestAnimationFrame(draw);
            return;
        }
        ctx.clearRect(0, 0, w, h);
        var grd = ctx.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, '#f0f9ff');
        grd.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        for(var i=0; i<particles.length; i++) {
            var p = particles[i];
            p.x += p.vx; p.y += p.vy;
            if(p.x < 0 || p.x > w) p.vx *= -1;
            if(p.y < 0 || p.y > h) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(14, 165, 233, 0.4)';
            ctx.fill();

            for(var j=i+1; j<particles.length; j++) {
                var p2 = particles[j];
                var dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                if(dist < maxDist) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = 'rgba(14, 165, 233, ' + (1 - dist/maxDist) * 0.25 + ')';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
    window.addEventListener('resize', function(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; });
}
window.addEventListener('load', initGameBG);

function getData() {
    // 1. 读取本地数据
    var localData = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    // 2. 补齐默认权限，防止崩溃
    if (!localData.permissions) {
        localData.permissions = {
            superadmin: ['dashboard','casegen','review','testcases','tasks','team','permission','settings','add_case','edit_case','delete_case','batch_delete_case','add_user','edit_user','delete_user','add_chart','update_status','assign_case','add_project','add_module'],
            admin: ['dashboard','casegen','review','testcases','tasks','team','settings','add_case','edit_case','delete_case','batch_delete_case','add_chart','update_status','assign_case','add_project','add_module'],
            tester: ['dashboard','casegen','review','testcases','tasks','add_case','edit_case','update_status']
        };
    }
    // 自动补入新增的 review 权限（兼容旧数据）
    ['superadmin','admin','tester'].forEach(function(role) {
        if (localData.permissions[role] && localData.permissions[role].indexOf('review') === -1) {
            var idx = localData.permissions[role].indexOf('testcases');
            if (idx !== -1) { localData.permissions[role].splice(idx, 0, 'review'); }
            else { localData.permissions[role].push('review'); }
        }
    });

    // 3. 补齐基本的系统和UI设置
    if (!localData.settings) {
        localData.settings = {
            basic: {sysName:'QA TestHub Ultimate', sysPageSize:'15', sysEmailNotify:true, sysAutoSave:true},
            ai: {aiEnabled:false, aiApiKey:'', aiApiUrl:''}
        };
    }
    if (!localData.ui) {
        localData.ui = {
            theme: 'default',
            // 【核心修改】：去掉了 col-executor 和 col-status
            columns: {'col-checkbox':true,'col-id':true,'col-module':true,'col-point':true,'col-level':true,'col-precondition':true,'col-steps':true,'col-expected':true,'col-remark':true,'col-creator':true,'col-actions':true}
        };
    } else if (localData.ui.columns) {
        // 【防爆设计】：强制删除老用户浏览器缓存里的废弃列数据，保持界面干净
        delete localData.ui.columns['col-executor'];
        delete localData.ui.columns['col-status'];
    }

    if (!localData.charts) {
        localData.charts = [
            {id: 1, type: 'pie', title: '用例状态分布'},
            {id: 2, type: 'bar', title: '各模块数量'},
            {id: 3, type: 'line', title: '用例增长趋势'}
        ];
    }

    // 4. 合并从后端拿到的真实业务数据
    localData.projects = globalData.projects || [];
    localData.testcases = globalData.testcases || [];
    localData.users = globalData.users || [];

    // 把基础配置写回本地
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        settings: localData.settings,
        ui: localData.ui,
        permissions: localData.permissions,
        charts: localData.charts
    }));

    return localData;
}

function setData(data) {
    // 只把系统设置、UI配置和【图表配置】存入本地
    var localConfig = {
        settings: data.settings,
        ui: data.ui,
        permissions: data.permissions,
        charts: data.charts // <--- 把图表加入白名单！
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localConfig));
}

function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]})}

// 【新增】：智能换行魔法函数，遇到 1. 2. 或 1、 2、 自动换行，且防止误伤 v1.2 这种版本号
function formatSteps(v){
    if(!v) return '-';
    var str = esc(v);
    // 核心逻辑：匹配数字+点/顿号，并且确认后面跟着的不是数字，就在它前面强制加一个换行符
    return str.replace(/(\s*)([0-9]+[\.、])(?!\d)/g, '\n$2').trim();
}
function showToast(message,type){var t=document.getElementById('toast');t.innerHTML=message;t.className='toast toast-'+type+' show';setTimeout(function(){t.classList.remove('show')},3000)}
function getRoleName(role){return({superadmin:'超级管理员',admin:'管理员',tester:'测试工程师'})[role]||role}
function hasPermission(perm){if(!currentUser)return false;var data=getData();return (data.permissions[currentUser.role]||[]).indexOf(perm)!==-1}
function closeAllPages(){document.querySelectorAll('.page-section').forEach(function(s){s.classList.remove('active')})}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function toggleUserMenu(){document.getElementById('userDropdown').classList.toggle('show')}
function showRegister(){document.getElementById('loginFormBox').style.display='none';document.getElementById('registerFormBox').style.display='block'; clearRegErrors();}
function showLogin(){document.getElementById('loginFormBox').style.display='block';document.getElementById('registerFormBox').style.display='none'}

// 页面加载时自动填充记住的账号密码
function loadRememberedAccount() {
    var remembered = localStorage.getItem('qa_remember_me');
    if (remembered === 'true') {
        var savedUser = localStorage.getItem('qa_saved_username');
        var savedPass = localStorage.getItem('qa_saved_password');
        if (savedUser) document.getElementById('username').value = savedUser;
        if (savedPass) document.getElementById('password').value = savedPass;
        document.getElementById('rememberMe').checked = true;
    }
}

async function handleLogin() {
    var u = document.getElementById('username').value.trim();
    var p = document.getElementById('password').value;

    if(!u || !p) { showToast('用户名和密码不能为空！', 'error'); return; }

    // 处理"记住账号密码"逻辑
    var rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
        localStorage.setItem('qa_remember_me', 'true');
        localStorage.setItem('qa_saved_username', u);
        localStorage.setItem('qa_saved_password', p);
    } else {
        localStorage.removeItem('qa_remember_me');
        localStorage.removeItem('qa_saved_username');
        localStorage.removeItem('qa_saved_password');
    }

    try {
        // 注意：登录这里必须用原生 fetch，因为此时还没有 Token
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;

            // 【核心修改点】：存入加密 Token
            localStorage.setItem('qa_token', data.token);
            // 保留用户名仅作前端轻量级展示记录
            localStorage.setItem('qa_currentUser', u);

            // 获取最新数据
            await fetchServerData();

            document.getElementById('loginPage').style.display='none';
            document.getElementById('mainApp').style.display='block';
            loadUISettings();
            fetchMessages(); // 页面加载后立即拉取一次
            updateAvatar();
            renderSidebar();
            switchPage('dashboard');
            applyPermissions();
            loadSettings();
            initColumnDropdown();
            populateGeneratorProjectSelect();
            renderCharts();

            showToast('登录成功！', 'success');
        } else {
            showToast(data.message || '用户名或密码错误！', 'error');
        }
    } catch (error) {
        showToast('网络错误，无法连接到服务器。', 'error');
    }
}

function clearRegErrors() {
    ['regChineseName','regUsername','regPhone','regEmail','regPassword','regConfirm'].forEach(function(id){
        var el = document.getElementById(id);
        if(el) el.classList.remove('has-error');
    });
}

async function handleRegister() {
    var cnEl = document.getElementById('regChineseName'), uEl = document.getElementById('regUsername'), phEl = document.getElementById('regPhone'), eEl = document.getElementById('regEmail'), pEl = document.getElementById('regPassword'), cEl = document.getElementById('regConfirm');
    var cn = cnEl.value.trim(), u = uEl.value.trim(), ph = phEl.value.trim(), e = eEl.value.trim(), p = pEl.value, c = cEl.value;
    var errors = [];
    clearRegErrors();

    // 你的原版校验逻辑保持不变
    if(!/^[\u4e00-\u9fa5]{2,10}$/.test(cn)){ cnEl.classList.add('has-error'); errors.push('中文名格式错误：只接受2至10位纯中文字符'); }
    if(!/^[a-zA-Z]{4,20}$/.test(u)){ uEl.classList.add('has-error'); errors.push('用户名格式错误：只接受4至20位纯英文字符'); }
    if(!ph){ phEl.classList.add('has-error'); errors.push('请填写必填项：手机号'); }
    if(!e || e.indexOf('@') === -1){ eEl.classList.add('has-error'); errors.push('请填写有效的邮箱地址'); }
    if(!p || !/[a-zA-Z]/.test(p) || !/[0-9]/.test(p) || /\|/.test(p) || !/^[a-zA-Z0-9?!@#$%^&*()_+.,:;\-]+$/.test(p)){
        pEl.classList.add('has-error'); errors.push('密码复杂度不足：必须包含字母和数字');
    }
    if(!c || p !== c){ cEl.classList.add('has-error'); errors.push('两次输入的密码不一致'); }

    if(errors.length > 0){ showToast(errors[0], 'error'); return; }

    try {
        // 向Flask后端发送注册请求
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: u,
                chineseName: cn,
                email: e,
                phone: ph,
                password: p
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('注册成功！正在前往登录界面...', 'success');
            setTimeout(function(){
                cnEl.value=''; uEl.value=''; phEl.value=''; eEl.value=''; pEl.value=''; cEl.value='';
                showLogin();
            }, 1200);
        } else {
            showToast(data.message, 'error'); // 比如“用户名已被占用”
        }
    } catch (error) {
        showToast('网络请求失败', 'error');
    }
}

function handleLogout(){
    // 【核心修改点】：清除 Token
    localStorage.removeItem('qa_token');
    localStorage.removeItem('qa_currentUser');
    localStorage.removeItem('qa_currentTab');
    localStorage.removeItem('qa_currentProject');
    localStorage.removeItem('qa_currentModule');
    localStorage.removeItem('qa_currentTaskFilter');
    localStorage.removeItem('qa_currentPage');
    location.reload();
}
function applyPermissions(){var btnAddCase=document.getElementById('btnAddCase'),btnAddChart=document.getElementById('btnAddChart');if(btnAddCase)btnAddCase.style.display=hasPermission('add_case')?'inline-block':'none';if(btnAddChart)btnAddChart.style.display=hasPermission('add_chart')?'inline-block':'none'}
function getNextId(arr){return arr.length?Math.max.apply(null,arr.map(function(x){return x.id}))+1:1}
function resequenceTestCaseIds(data) {if (data.testcases && data.testcases.length > 0) {data.testcases.forEach(function(tc, index) {tc.id = index + 1;});}}

function updateAvatar(){
    if(!currentUser)return;
    var html='👤';
    if(currentUser.avatar==='male')html='👨‍💼';
    else if(currentUser.avatar==='female')html='👩‍💼';
    else if(currentUser.avatar==='custom'&&currentUser.avatarData)html='<img src="'+currentUser.avatarData+'">';
    document.getElementById('avatarIcon').innerHTML=html;
    document.getElementById('dropAvatarIcon').innerHTML=html;
    document.getElementById('dropChineseName').textContent=currentUser.chineseName||currentUser.username;
    document.getElementById('dropUsername').textContent=currentUser.username;
    document.getElementById('dropRole').textContent=getRoleName(currentUser.role);
}

function getUserAvatarHTML(user){
  if(!user)return '👤';
  if(user.avatar==='male')return '👨‍💼';
  if(user.avatar==='female')return '👩‍💼';
  if(user.avatar==='custom'&&user.avatarData)return '<img src="'+user.avatarData+'">';
  return '👤';
}

function initAvatarEditorEvents(){
  var img=document.getElementById('avatarEditorImage');
  if(!img||img.dataset.bound==='1')return;
  img.dataset.bound='1';
  var start=function(clientX,clientY){
    if(!avatarEditState.rawData)return;
    avatarEditState.isDragging=true;
    avatarEditState.startX=clientX;
    avatarEditState.startY=clientY;
    avatarEditState.baseX=avatarEditState.x;
    avatarEditState.baseY=avatarEditState.y;
    img.classList.add('dragging');
  };
  var move=function(clientX,clientY){
    if(!avatarEditState.isDragging)return;
    avatarEditState.x=avatarEditState.baseX+(clientX-avatarEditState.startX);
    avatarEditState.y=avatarEditState.baseY+(clientY-avatarEditState.startY);
    clampAvatarPosition();
    applyAvatarTransform();
  };
  var end=function(){avatarEditState.isDragging=false;img.classList.remove('dragging')};

  img.addEventListener('mousedown',function(e){e.preventDefault();start(e.clientX,e.clientY)});
  window.addEventListener('mousemove',function(e){move(e.clientX,e.clientY)});
  window.addEventListener('mouseup',end);
  img.addEventListener('touchstart',function(e){if(e.touches[0])start(e.touches[0].clientX,e.touches[0].clientY)},{passive:true});
  window.addEventListener('touchmove',function(e){if(e.touches[0])move(e.touches[0].clientX,e.touches[0].clientY)},{passive:false});
  window.addEventListener('touchend',end);
}

function clampAvatarPosition(){
  var size=200;
  var drawWidth=avatarEditState.naturalWidth*avatarEditState.scale;
  var drawHeight=avatarEditState.naturalHeight*avatarEditState.scale;
  var limitX=Math.max(0,(drawWidth-size)/2);
  var limitY=Math.max(0,(drawHeight-size)/2);
  if(avatarEditState.x > limitX) avatarEditState.x = limitX;
  if(avatarEditState.x < -limitX) avatarEditState.x = -limitX;
  if(avatarEditState.y > limitY) avatarEditState.y = limitY;
  if(avatarEditState.y < -limitY) avatarEditState.y = -limitY;
}

function applyAvatarTransform(){
  var img=document.getElementById('avatarEditorImage');
  if(!img)return;
  img.style.transform='translate(calc(-50% + '+avatarEditState.x+'px), calc(-50% + '+avatarEditState.y+'px)) scale('+avatarEditState.scale+')';
  var cvs=document.getElementById('avatarPreviewCanvas');
  if(cvs && avatarEditState.rawData){
      var ctx=cvs.getContext('2d');
      ctx.clearRect(0, 0, 140, 140);
      ctx.save();
      ctx.translate(70, 70);
      var previewScale = 140 / 200;
      ctx.scale(previewScale, previewScale);
      ctx.translate(avatarEditState.x, avatarEditState.y);
      ctx.scale(avatarEditState.scale, avatarEditState.scale);
      ctx.drawImage(img, -img.naturalWidth/2, -img.naturalHeight/2);
      ctx.restore();
  }
}

function updateAvatarEditor(){
  var zoom=document.getElementById('avatarZoom');
  if(!zoom)return;
  avatarEditState.scale=parseFloat(zoom.value||'1');
  clampAvatarPosition();
  applyAvatarTransform();
}

function resetAvatarEditor(){
  var zoom=document.getElementById('avatarZoom');
  avatarEditState.scale=avatarEditState.minScale||1;
  avatarEditState.x=0;avatarEditState.y=0;
  if(zoom)zoom.value=String(avatarEditState.scale);
  applyAvatarTransform();
}

function showAvatarEditor(dataUrl){
  var img=document.getElementById('avatarEditorImage');
  var zoom=document.getElementById('avatarZoom');
  initAvatarEditorEvents();
  avatarEditState.rawData=dataUrl;
  img.onload=function(){
    var size=200;
    avatarEditState.naturalWidth=img.naturalWidth;
    avatarEditState.naturalHeight=img.naturalHeight;
    avatarEditState.minScale=Math.max(size/img.naturalWidth, size/img.naturalHeight);
    if(avatarEditState.minScale>3)avatarEditState.minScale=3;
    avatarEditState.scale=avatarEditState.minScale;
    avatarEditState.x=0;avatarEditState.y=0;
    zoom.min=String(avatarEditState.minScale);
    zoom.value=String(avatarEditState.scale);
    applyAvatarTransform();
  };
  img.src=dataUrl;
}

function initColumnDropdown(){var data=getData();if(!data.ui)data.ui={theme:'default',columns:{}};if(!data.ui.columns)data.ui.columns={};var html='';columnConfig.forEach(function(item){var checked=data.ui.columns[item[0]]!==false?'checked':'';html+='<div class="column-option"><input type="checkbox" id="'+item[0]+'" '+checked+' onchange="saveColumnSettings();renderTable()"><label for="'+item[0]+'">'+item[1]+'</label></div>'});document.getElementById('columnDropdown').innerHTML=html}
function saveColumnSettings(){var data=getData();if(!data.ui)data.ui={theme:'default',columns:{}};data.ui.columns={};columnConfig.forEach(function(item){var el=document.getElementById(item[0]);data.ui.columns[item[0]]=!!(el&&el.checked)});setData(data)}
function isColumnVisible(colId){var el=document.getElementById(colId);return el?el.checked:true}
function loadUISettings(){var data=getData();var theme=(data.ui&&data.ui.theme)||'default';applyTheme(theme);pageSize=parseInt((data.settings&&data.settings.basic&&data.settings.basic.sysPageSize)||'15',10);if(document.getElementById('pageSize'))document.getElementById('pageSize').value=String(pageSize);if(document.getElementById('rvPageSize'))document.getElementById('rvPageSize').value=String(pageSize);if(document.getElementById('taskPageSize'))document.getElementById('taskPageSize').value=String(pageSize);}
function applyTheme(theme){currentTheme=theme;document.documentElement.setAttribute('data-theme',theme==='default'?'':theme);var data=getData();if(!data.ui)data.ui={columns:{}};data.ui.theme=theme;setData(data)}
function toggleTheme(){var idx=themeOrder.indexOf(currentTheme);if(idx<0)idx=0;idx=(idx+1)%themeOrder.length;applyTheme(themeOrder[idx]);renderThemeOptions();showToast('已切换主题：'+themeMeta[currentTheme].name,'success')}
function openThemeConfig(){renderThemeOptions();document.getElementById('themeModal').classList.add('show')}
function renderThemeOptions(){var box=document.getElementById('themeOptions');var html='';themeOrder.forEach(function(key){html+='<div class="theme-option '+(currentTheme===key?'selected':'')+'" onclick="selectTheme(\''+key+'\')"><div class="theme-preview" style="background:'+themeMeta[key].preview+'"></div><div>'+themeMeta[key].name+'</div></div>'});box.innerHTML=html}
function selectTheme(theme){applyTheme(theme);renderThemeOptions();showToast('已切换主题：'+themeMeta[theme].name,'success')}

// 【完整替换】：用例仓库项目折叠函数
function toggleProjectExpand(e, id) {
    if (e) e.stopPropagation();
    var pKey = 'proj_' + id;
    expandedMenu[pKey] = !expandedMenu[pKey];
    localStorage.setItem('qa_expandedMenu', JSON.stringify(expandedMenu));
    renderSidebar();
}

// 【权限设置修复版】侧边栏渲染函数
function renderSidebar(){
    var data = getData();
    var nav = document.getElementById('sidebarNav');
    if (!nav) return;
    var html = '';

    // 1. 首页
    html += '<div class="nav-item"><div class="nav-link '+(currentTab==='dashboard'?'active':'')+'" onclick="switchPage(\'dashboard\')"><div class="nav-link-left"><span class="nav-icon icon-blue">'+svgIcons.dashboard+'</span><span>首页</span></div></div></div>';
    html += '<div class="nav-divider"></div>';

    // 2. 用例生成
    if(hasPermission('casegen')) {
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='casegen'?'active':'')+'" onclick="switchPage(\'casegen\')"><div class="nav-link-left"><span class="nav-icon icon-purple">'+svgIcons.casegen+'</span><span>用例生成</span></div></div></div>';
    }

    // 3. 用例审核
    if(hasPermission('review')){
        var isRevExp = expandedMenu.review === true;
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='review'?'active':'')+'"><div class="nav-link-left" onclick="switchPage(\'review\');"><span class="nav-icon icon-pink">'+svgIcons.review+'</span><span>用例审核</span></div><div class="expand-btn '+(isRevExp?'expanded':'')+'" onclick="toggleExpand(event,\'review\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>';
        html += '<div class="submenu '+(isRevExp?'open':'')+'">';

        [['pending','待审核'],['rejected','未通过']].forEach(function(item){
            var subKey = 'rv_sub_' + item[0];
            var isSubExp = expandedMenu[subKey] === true;

            // 【核心修复】：移除 !currentReviewModuleId 限制，确保选中子模块时，父级（待审核/未通过）依然保持高亮
            var isReviewSubActive = (currentTab === 'review' && currentReviewFilter === item[0]);

            html += '<div class="submenu-item '+(isReviewSubActive?'active':'')+'">';
            html += '<div class="item-title" onclick="switchReviewFilter(\''+item[0]+'\',\''+item[1]+'\')"><span class="sub-icon '+(item[0]==='pending'?'sub-icon-pending':'sub-icon-rejected')+'">'+reviewSubIcons[item[0]]+'</span><span>'+item[1]+'</span></div>';

            // 【精准满足需求】：跳过项目，直接去查当前分类下有哪些“审核模块”
            var rvMods = getReviewModules().filter(function(m){ return (m.category || 'pending') === item[0]; });

            if(rvMods.length > 0) {
                // 如果有模块，给它挂上右侧的下拉展开箭头
                html += '<div class="item-actions"><div class="expand-btn '+(isSubExp?'expanded':'')+'" onclick="toggleExpand(event,\''+subKey+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div></div>';

                if(isSubExp) {
                    /* 【新增 only-module-scroll-box 限制审核模块超过6个滚动】 */
                    html += '<div class="submenu open only-module-scroll-box">';
                    rvMods.forEach(function(mod){
                        // 判断当前模块是否被选中
                        var isModActive = (currentTab === 'review' && currentReviewFilter === item[0] && currentReviewModuleId === String(mod.id));

                        // 【渲染模块页签】：高度完美锁定 38px，左侧缩进对齐，点击直接跳入用例列表
                        html += '<div class="module-item '+(isModActive?'active':'')+'" style="padding: 0 14px 0 52px; height: 38px; font-size: 13px;" onclick="jumpReviewModule(\''+item[0]+'\', \''+item[1]+'\', \''+mod.projectId+'\', \''+mod.id+'\')"><div class="item-title"><span class="sub-icon sub-icon-file">'+hierarchyIcons.file+'</span><span>'+esc(mod.name)+'</span></div></div>';
                    });
                    html += '</div>';
                }
            } else {
                html += '</div>'; // 如果该分类下没有模块，直接闭合标签
            }
        });
        html += '</div></div>';
    }

    // 4. 用例仓库
    var isTcExp = expandedMenu.testcases === true;
    html += '<div class="nav-item"><div class="nav-link '+(currentTab==='testcases'?'active':'')+'"><div class="nav-link-left" onclick="switchPage(\'testcases\', true)"><span class="nav-icon icon-green">'+svgIcons.testcases+'</span><span>用例仓库</span></div><div class="expand-btn '+(isTcExp?'expanded':'')+'" onclick="toggleExpand(event,\'testcases\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>';
    html += '<div class="submenu '+(isTcExp?'open':'')+'">';
    data.projects.forEach(function(proj){
        // 【核心新增】：如果项目标记了被仓库删除，直接不画它
        if(proj.isRepoDeleted === true) return;
        var pKey = 'proj_'+proj.id;
        var isProjExp = expandedMenu[pKey] === true;

        // 【核心修复 2】：大前提锁！只有在 currentTab 是 testcases（用例仓库）时，才允许项目高亮，绝对避免切到别的页面时串台！
        var isProjActive = (currentTab === 'testcases' && currentProject === String(proj.id));
        html += '<div class="project-item '+(isProjActive?'active':'')+'" onclick="selectProject(\''+proj.id+'\',\''+esc(proj.name)+'\')">';

        html += '<div class="item-title"><span class="sub-icon sub-icon-folder">'+hierarchyIcons.folder+'</span><span>'+esc(proj.name)+'</span></div>';
        html += '<div class="item-actions"><div class="expand-btn '+(isProjExp?'expanded':'')+'" onclick="toggleProjectExpand(event,\''+proj.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div></div>';
        if(isProjExp) {
            /* 【新增 only-module-scroll-box 限制仓库模块超过6个滚动】 */
            html += '<div class="submenu open module-list-container only-module-scroll-box">';
            (proj.modules||[]).forEach(function(mod){

                // 【本次新增核心拦截】：如果这个模块被标记为“已隐藏”，我们就假装没看见它！直接跳过！
                if(mod.isRepoDeleted === true) return;

                // 【核心修复 3】：同理，给模块高亮也加上大前提锁！
                var isModActive = (currentTab === 'testcases' && currentModule === String(mod.id));
                html += '<div class="module-item '+(isModActive?'active':'')+'" onclick="selectModule(\''+proj.id+'\',\''+mod.id+'\',\''+esc(mod.name)+'\')"><div class="item-title"><span class="sub-icon sub-icon-file">'+hierarchyIcons.file+'</span><span>'+esc(mod.name)+'</span></div></div>';

            });
            html += '</div>';
        }
    });
    html += '</div></div><div class="nav-divider"></div>';

    // 5. 任务中心
    if(hasPermission('tasks')){
        var isTaskExp = expandedMenu.tasks === true;
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='tasks'?'active':'')+'"><div class="nav-link-left" onclick="switchPage(\'tasks\')"><span class="nav-icon icon-orange">'+svgIcons.tasks+'</span><span>任务中心</span></div><div class="expand-btn '+(isTaskExp?'expanded':'')+'" onclick="toggleExpand(event,\'tasks\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div>';
        html += '<div class="submenu '+(isTaskExp?'open':'')+'">';
        [['myCharge','我负责的'],['myCreate','我创建的'],['myAssign','我分配的'],['completed','已完成']].forEach(function(item){
            var subKey = 'task_sub_'+item[0];
            var isSubExp = expandedMenu[subKey] === true;
            var isSubActive = (currentTab==='tasks' && currentTaskFilter===item[0]);
            html += '<div class="submenu-item '+(isSubActive?'active':'')+'">';
            html += '<div class="item-title" onclick="switchTaskFilter(\''+item[0]+'\',\''+item[1]+'\')"><span class="sub-icon sub-icon-task">'+taskSubIcons[item[0]]+'</span><span>'+item[1]+'</span></div>';
            html += '<div class="item-actions"><div class="expand-btn '+(isSubExp?'expanded':'')+'" onclick="toggleExpand(event,\''+subKey+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div></div>';
            if(isSubExp) {
                html += '<div class="submenu open module-list-container">';
                data.projects.forEach(function(proj){
                    var hasD = (data.testcases||[]).some(function(tc){
                        if(String(tc.projectId)!==String(proj.id)) return false;
                        if (item[0] === 'myCreate') return tc.creator === currentUser.username;
                        if (item[0] === 'myCharge') return tc.executor === currentUser.username;
                        if (item[0] === 'myAssign') return tc.assignedBy === currentUser.username;
                        if (item[0] === 'completed') return (tc.status === '通过' || tc.status === '未通过');
                        return false;
                    });
                    if(hasD) {
                        var pK = 'task_proj_'+item[0]+'_'+proj.id;
                        var pE = expandedMenu[pK] === true;

                        // 【终极 UI 修复 1】：彻底锁定项目页签的物理高度（38px）、14px字号和精确内边距，拒绝被父级撑大！
                        var isProjActive = (isSubActive && currentTaskProject === String(proj.id));
                        html += '<div class="project-item '+(isProjActive?'active':'')+'" style="padding: 0 14px 0 52px; height: 38px; font-size: 14px;" onclick="selectTaskSubItem(\''+item[0]+'\', \''+proj.id+'\', \'\')">';

                        html += '<div class="item-title"><span class="sub-icon sub-icon-folder">'+hierarchyIcons.folder+'</span><span>'+esc(proj.name)+'</span></div>';
                        html += '<div class="item-actions"><div class="expand-btn '+(pE?'expanded':'')+'" onclick="toggleTaskProjectExpand(event,\''+pK+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div></div></div>';

                        if(pE) {
                            /* 【新增 only-module-scroll-box 限制任务中心模块超过6个滚动】 */
                            html += '<div class="submenu open module-list-container only-module-scroll-box">';
                            (proj.modules||[]).forEach(function(mod){
                                var modHasD = (data.testcases||[]).some(function(tc){
                                    if(String(tc.moduleId)!==String(mod.id)) return false;
                                    if (item[0] === 'myCreate') return tc.creator === currentUser.username;
                                    if (item[0] === 'myCharge') return tc.executor === currentUser.username;
                                    if (item[0] === 'myAssign') return tc.assignedBy === currentUser.username;
                                    if (item[0] === 'completed') return (tc.status === '通过' || tc.status === '未通过');
                                    return false;
                                });
                                if(modHasD) {
                                    // 【终极 UI 修复 2】：彻底锁定模块页签的物理高度（38px）、13px字号和精确内边距！
                                    var isModActive = (isSubActive && currentTaskProject === String(proj.id) && currentTaskModule === String(mod.id));
                                    html += '<div class="module-item '+(isModActive?'active':'')+'" style="padding: 0 14px 0 68px; height: 38px; font-size: 13px;" onclick="selectTaskSubItem(\''+item[0]+'\', \''+proj.id+'\', \''+mod.id+'\')"><div class="item-title"><span class="sub-icon sub-icon-file">'+hierarchyIcons.file+'</span><span>'+esc(mod.name)+'</span></div></div>';
                                }
                            });
                            html += '</div>';
                        }
                    }
                });
                html += '</div>';
            }
        });
        // 【核心修复】：在任务中心代码块结束时，增加与上方完全一致的 nav-divider 分割线
        html += '</div></div><div class="nav-divider"></div>';
    }

    // 6. 其他页签 (团队管理、权限配置、系统设置)
    if(hasPermission('team')) {
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='team'?'active':'')+'" onclick="switchPage(\'team\')"><div class="nav-link-left"><span class="nav-icon icon-teal">'+svgIcons.team+'</span><span>团队管理</span></div></div></div>';
    }
    if(hasPermission('permission')) {
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='permission'?'active':'')+'" onclick="switchPage(\'permission\')"><div class="nav-link-left"><span class="nav-icon icon-gray">'+svgIcons.permission+'</span><span>权限配置</span></div></div></div>';
    }
    if(hasPermission('settings')) {
        html += '<div class="nav-item"><div class="nav-link '+(currentTab==='settings'?'active':'')+'" onclick="switchPage(\'settings\')"><div class="nav-link-left"><span class="nav-icon icon-gray">'+svgIcons.settings+'</span><span>系统设置</span></div></div></div>';
    }

    nav.innerHTML = html;
}

// 【完整替换】：任务中心项目折叠函数
function toggleTaskProjectExpand(e, expandKey) {
    if (e) e.stopPropagation();
    expandedMenu[expandKey] = !expandedMenu[expandKey];
    localStorage.setItem('qa_expandedMenu', JSON.stringify(expandedMenu));
    renderSidebar();
}

function clearCaseSelectionState(){
    currentProject=''; currentModule=''; selectedCases=[];
    localStorage.removeItem('qa_currentProject'); localStorage.removeItem('qa_currentModule');
}

// 【完整替换】：通用折叠函数
function toggleExpand(e, menu) {
    if (e) e.stopPropagation(); // 阻止事件冒泡，防止点击箭头时触发页面跳转
    expandedMenu[menu] = !expandedMenu[menu];
    localStorage.setItem('qa_expandedMenu', JSON.stringify(expandedMenu));
    renderSidebar(); // 重新渲染以应用箭头旋转和显示子菜单
}

function switchPage(page, forceClearState = false){
    currentTab = page;
    currentPage = 1;
    localStorage.setItem('qa_currentTab', page);
    localStorage.setItem('qa_currentPage', currentPage);

    closeAllPages();
    var pEl = document.getElementById('page-'+page);
    if(pEl) pEl.classList.add('active');

    if(page !== 'testcases' || forceClearState) {
        clearCaseSelectionState();
    }

    if(page!=='tasks') {
        currentTaskFilter='myCharge';
        localStorage.setItem('qa_currentTaskFilter', 'myCharge');
    }

    if(page==='review'){
        expandedMenu.review = true;
    }
    var titles={dashboard:'首页',casegen:'用例生成',review:'用例审核 - ' + ({'pending':'待审核','rejected':'未通过'}[currentReviewFilter]||'待审核'),testcases:'用例仓库',tasks:'任务中心 - '+({'myCharge':'我负责的','myCreate':'我创建的','myAssign':'我分配的','completed':'已完成'})[currentTaskFilter],team:'团队管理',permission:'权限配置',settings:'系统设置'};
    document.getElementById('pageTitle').textContent=titles[page]||'首页';
    document.getElementById('columnDropdown').classList.remove('show');

    renderSidebar();

    if(page==='dashboard'){updateStats();renderCharts();}
    else if(page==='casegen'){populateGeneratorProjectSelect();renderGeneratedPreview();}
    else if(page==='review'){renderReviewPage();}
    else if(page==='testcases'){renderTestCaseView();}
    else if(page==='tasks'){document.getElementById('taskTitle').textContent='任务中心 - '+({'myCharge':'我负责的','myCreate':'我创建的','myAssign':'我分配的','completed':'已完成'})[currentTaskFilter];renderTaskTable();}
    else if(page==='team'){renderTeamTable();}
    else if(page==='permission'){renderPermissions();}
    else if(page==='settings'){loadSettings();}
}

function selectProject(projectId,projectName){
    currentTab='testcases'; currentProject=String(projectId); currentModule=''; currentPage=1; selectedCases=[];
    localStorage.setItem('qa_currentProject', currentProject);
    localStorage.removeItem('qa_currentModule');
    localStorage.setItem('qa_currentPage', currentPage);
    closeAllPages(); document.getElementById('page-testcases').classList.add('active');
    renderSidebar(); renderTestCaseView();
}

function selectModule(projectId,moduleId,moduleName){
    currentTab='testcases'; currentProject=String(projectId); currentModule=String(moduleId); currentPage=1; selectedCases=[];
    localStorage.setItem('qa_currentProject', currentProject);
    localStorage.setItem('qa_currentModule', currentModule);
    localStorage.setItem('qa_currentPage', currentPage);
    closeAllPages(); document.getElementById('page-testcases').classList.add('active');
    renderSidebar(); renderTestCaseView();
}

function switchTaskFilter(filter,name){
    currentTab='tasks';
    currentTaskFilter=filter;
    localStorage.setItem('qa_currentTaskFilter', filter);
    localStorage.setItem('qa_currentTab', 'tasks');

    // 【核心修复】：点击菜单时，清空之前选中的任务项目和模块
    currentTaskProject = '';
    currentTaskModule = '';

    // 【本次新增】：同步清除本地的子级缓存，保持状态干净
    localStorage.removeItem('qa_currentTaskProject');
    localStorage.removeItem('qa_currentTaskModule');

    taskSelectedCases = []; // 切换菜单时立刻清空勾选池
    var taskBar = document.getElementById('taskBatchActions');
    if(taskBar) taskBar.style.display = 'none';

    currentProject=''; // 原有用例仓库的状态重置
    currentModule='';

    closeAllPages();
    document.getElementById('page-tasks').classList.add('active');
    document.getElementById('pageTitle').textContent='任务中心 - '+name;
    document.getElementById('taskTitle').textContent='任务中心 - '+name;
    renderSidebar();
    renderTaskTable(); // 重新渲染右侧
}

// 【新增】：处理任务中心内部的项目/模块选择 (带记忆版)
function selectTaskSubItem(filter, projId, modId) {
    currentTab = 'tasks';
    currentTaskFilter = filter;
    currentTaskProject = String(projId);
    currentTaskModule = String(modId);

    // 【核心修复1】：强制隐藏其他页面，切回“任务中心”视图，并更新本地缓存
    localStorage.setItem('qa_currentTab', 'tasks');

    // 【本次新增】：将当前选中的任务项目和模块存入缓存，防止刷新后丢失！
    localStorage.setItem('qa_currentTaskProject', currentTaskProject);
    localStorage.setItem('qa_currentTaskModule', currentTaskModule);

    closeAllPages();
    var pEl = document.getElementById('page-tasks');
    if(pEl) pEl.classList.add('active');

    // 切换项目/模块时，顺手清空之前的勾选池，隐藏批量操作栏
    taskSelectedCases = [];
    var taskBar = document.getElementById('taskBatchActions');
    if(taskBar) taskBar.style.display = 'none';

    renderSidebar();
    renderTaskTable();
}

// ================= 用例审核模块 =================
var reviewSelectedIds = [];
var currentReviewProjectId = '';
var currentReviewModuleId = '';

// 独立的审核项目/模块数据（与用例仓库完全分离）
function getReviewProjects() {
    return JSON.parse(localStorage.getItem('qa_review_projects') || '[]');
}
function saveReviewProjects(list) {
    localStorage.setItem('qa_review_projects', JSON.stringify(list));
}
function getReviewModules() {
    return JSON.parse(localStorage.getItem('qa_review_modules') || '[]');
}
function saveReviewModules(list) {
    localStorage.setItem('qa_review_modules', JSON.stringify(list));
}
function getReviewTestcases() {
    return JSON.parse(localStorage.getItem('qa_review_testcases') || '[]');
}
function saveReviewTestcases(list) {
    localStorage.setItem('qa_review_testcases', JSON.stringify(list));
}
function addReviewProject(name, category) {
    var list = getReviewProjects();
    var id = 'rp_' + Date.now();
    list.push({ id: id, name: name, category: category || 'pending' });
    saveReviewProjects(list);
    return id;
}
function addReviewModule(projectId, name, category) {
    var list = getReviewModules();
    var id = 'rm_' + Date.now();
    list.push({ id: id, projectId: projectId, name: name, category: category || 'pending' });
    saveReviewModules(list);
    return id;
}
function deleteReviewProject(id) {
    var list = getReviewProjects().filter(function(p) { return p.id !== id; });
    saveReviewProjects(list);
    // 删除该项目下的所有模块
    var delModIds = getReviewModules().filter(function(m) { return m.projectId === id; }).map(function(m) { return m.id; });
    var mods = getReviewModules().filter(function(m) { return m.projectId !== id; });
    saveReviewModules(mods);
    // 删除该项目下的所有用例
    var tcs = getReviewTestcases().filter(function(tc) { return String(tc.projectId) !== String(id); });
    saveReviewTestcases(tcs);
}
function deleteReviewModule(id) {
    var list = getReviewModules().filter(function(m) { return m.id !== id; });
    saveReviewModules(list);
    // 删除该模块下的所有用例
    var tcs = getReviewTestcases().filter(function(tc) { return String(tc.moduleId) !== String(id); });
    saveReviewTestcases(tcs);
}

function switchReviewFilter(filter, name) {
    currentTab = 'review';
    currentReviewFilter = filter;
    currentReviewProjectId = '';
    currentReviewModuleId = '';
    localStorage.setItem('qa_currentTab', 'review');
    localStorage.setItem('qa_currentReviewFilter', filter);
    localStorage.removeItem('qa_rv_projectId');
    localStorage.removeItem('qa_rv_moduleId');
    expandedMenu.review = true;
    closeAllPages();
    document.getElementById('page-review').classList.add('active');
    renderSidebar();
    renderReviewView();
}

function jumpReviewModule(filter, filterName, projectId, moduleId) {
    currentTab = 'review';
    currentReviewFilter = filter;
    currentReviewProjectId = projectId;
    currentReviewModuleId = moduleId;
    localStorage.setItem('qa_currentTab', 'review');
    localStorage.setItem('qa_currentReviewFilter', filter);
    localStorage.setItem('qa_rv_projectId', projectId);
    localStorage.setItem('qa_rv_moduleId', moduleId);
    expandedMenu.review = true;
    expandedMenu['rv_' + filter] = true;
    closeAllPages();
    document.getElementById('page-review').classList.add('active');
    renderSidebar();
    renderReviewView();
}

function getReviewData() {
    var stored = JSON.parse(localStorage.getItem('qa_review_data') || '{}');
    return stored;
}
function saveReviewData(data) {
    localStorage.setItem('qa_review_data', JSON.stringify(data));
}
function getCaseReviewStatus(caseId) {
    var rd = getReviewData();
    return rd[caseId] || 'pending';
}

function renderReviewPage() {
    currentReviewFilter = '';
    currentReviewProjectId = '';
    currentReviewModuleId = '';
    localStorage.removeItem('qa_currentReviewFilter');
    localStorage.removeItem('qa_rv_projectId');
    localStorage.removeItem('qa_rv_moduleId');
    renderReviewView();
}

function hideAllReviewViews() {
    ['rv-view-categories','rv-view-projects','rv-view-modules','rv-view-list'].forEach(function(id) {
        document.getElementById(id).style.display = 'none';
    });
}

function renderReviewView() {
    hideAllReviewViews();
    var data = getData();
    var rd = getReviewData();
    var filterNames = {'pending':'待审核','rejected':'未通过'};

    // 第1层：分类卡片
    if (!currentReviewFilter) {
        var pendingCount = 0, rejectedCount = 0;
        (data.testcases || []).forEach(function(tc) {
            var s = rd[tc.id] || 'pending';
            if (s === 'pending') pendingCount++;
            else if (s === 'rejected') rejectedCount++;
        });
        document.getElementById('pageTitle').textContent = '用例审核';
        document.getElementById('rv-view-categories').style.display = 'block';
        var html = '';
        html += '<div class="grid-card" onclick="switchReviewFilter(\'pending\',\'待审核\')"><h3>' + reviewSubIcons.pending + ' 待审核</h3><p style="margin-top:12px">当前共有 <strong>' + pendingCount + '</strong> 条用例等待审核</p><div class="grid-card-footer">进入审核 →</div></div>';
        html += '<div class="grid-card" onclick="switchReviewFilter(\'rejected\',\'未通过\')"><h3>' + reviewSubIcons.rejected + ' 未通过</h3><p style="margin-top:12px">当前共有 <strong>' + rejectedCount + '</strong> 条用例审核未通过</p><div class="grid-card-footer">查看详情 →</div></div>';
        document.getElementById('reviewCategoryGrid').innerHTML = html;
        return;
    }

    var statusLabel = filterNames[currentReviewFilter] || '';

    // ================= 核心修改：合并第2层与第3层 =================
    // 直接展示【模块卡片】（彻底跳过项目层级直达模块）
    if (!currentReviewModuleId) {
        document.getElementById('pageTitle').textContent = '用例审核 - ' + statusLabel;
        document.getElementById('rv-view-modules').style.display = 'block';

        var btnMod = document.getElementById('btnAddReviewModuleMod');
        if (btnMod) btnMod.style.display = (currentReviewFilter === 'rejected') ? 'none' : '';

        // 直接获取当前状态（待审核/未通过）下的【所有模块】，不再受限于当前项目
        var rvModules = getReviewModules().filter(function(m) { return (m.category || 'pending') === currentReviewFilter; });
        var rvProjects = getReviewProjects(); // 用于反查项目名称
        var rd = getReviewData();
        var rvTcs = getReviewTestcases();
        var html = '';

        rvModules.forEach(function(m) {
            var cnt = 0;
            rvTcs.forEach(function(tc) {
                if (String(tc.moduleId) === String(m.id) && (rd[tc.id] || 'pending') === currentReviewFilter) cnt++;
            });

            // 智能反查：获取该模块所属的项目名称，方便在卡片上展示
            var projName = '未知项目';
            rvProjects.forEach(function(p){ if(String(p.id) === String(m.projectId)) projName = p.name; });

            var isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
            var delBtn = isAdmin ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); confirmDeleteReviewModule(\'' + m.id + '\')">删除</button>' : '';
            var editBtn = '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditModuleModal(\''+m.projectId+'\', \'' + m.id + '\', \'' + esc(m.name).replace(/'/g, "\\'") + '\')">重命名</button>';

            // 核心修改：点击卡片时，带着项目ID和模块ID直接 jump 到用例列表
            html += '<div class="grid-card" onclick="jumpReviewModule(\''+currentReviewFilter+'\', \''+statusLabel+'\', \''+m.projectId+'\', \''+m.id+'\')">' +
                    editBtn + delBtn +
                    '<h3>' + hierarchyIcons.file + ' ' + esc(m.name) + '</h3>' +
                    '<p style="margin-top:8px; font-size:12px; color:var(--primary); font-weight:600;">所属项目：' + esc(projName) + '</p>' +
                    '<p style="margin-top:6px;">' + statusLabel + '用例：<strong>' + cnt + '</strong> 条</p>' +
                    '<div class="grid-card-footer">进入模块 →</div></div>';
        });

        if (!html) html = '<div class="empty-state" style="grid-column:1/-1">暂无审核模块，请点击右上角新建。</div>';
        document.getElementById('reviewModuleGrid').innerHTML = html;
        return;
    }
    // ================= 修改结束 =================

    // 第4层：用例列表
    var rvProjects = getReviewProjects();
    var rvModules = getReviewModules();
    var projName = '', modName = '';
    rvProjects.forEach(function(p) { if (String(p.id) === String(currentReviewProjectId)) projName = p.name; });
    rvModules.forEach(function(m) { if (String(m.id) === String(currentReviewModuleId)) modName = m.name; });
    document.getElementById('pageTitle').textContent = '用例审核 - ' + statusLabel + ' - ' + projName + ' - ' + modName;
    document.getElementById('rv-view-list').style.display = 'flex';
    var btnImport = document.getElementById('btnImportReview');
    if (btnImport) btnImport.style.display = (currentReviewFilter === 'rejected') ? 'none' : '';
    renderReviewTable();
}

function selectReviewProject(projectId, name) {
    currentReviewProjectId = String(projectId);
    currentReviewModuleId = '';
    localStorage.setItem('qa_rv_projectId', currentReviewProjectId);
    localStorage.removeItem('qa_rv_moduleId');
    renderReviewView();
}

function selectReviewModule(moduleId, name) {
    currentReviewModuleId = String(moduleId);
    localStorage.setItem('qa_rv_moduleId', currentReviewModuleId);
    renderReviewView();
}

function openAddReviewProjectModal() {
    var name = prompt('请输入审核项目名称：');
    if (!name || !name.trim()) return;
    addReviewProject(name.trim());
    showToast('项目创建成功', 'success');
    renderReviewView();
}

function confirmDeleteReviewProject(id) {
    if (!confirm('确定要删除此审核项目及其下所有模块吗？')) return;
    deleteReviewProject(id);
    showToast('项目已删除', 'success');
    renderReviewView();
    renderSidebar(); // 核心修复：立刻刷新左侧菜单，让它瞬间消失
}

function renameReviewProject(id) {
    var projects = getReviewProjects();
    var proj = projects.find(function(p) { return p.id === id; });
    if (!proj) return;
    var newName = prompt('请输入新的项目名称：', proj.name);
    if (!newName || !newName.trim() || newName.trim() === proj.name) return;
    proj.name = newName.trim();
    saveReviewProjects(projects);
    showToast('项目已重命名', 'success');
    renderReviewView();
    renderSidebar();
}

function renameReviewModule(id) {
    var modules = getReviewModules();
    var mod = modules.find(function(m) { return m.id === id; });
    if (!mod) return;
    var newName = prompt('请输入新的模块名称：', mod.name);
    if (!newName || !newName.trim() || newName.trim() === mod.name) return;
    mod.name = newName.trim();
    saveReviewModules(modules);
    showToast('模块已重命名', 'success');
    renderReviewView();
    renderSidebar();
}

function openAddReviewModuleModal() {
    document.getElementById('rvModuleProject').value = '';
    document.getElementById('rvModuleName').value = '';
    document.getElementById('reviewModuleModal').classList.add('show');
}

function submitReviewModule() {
    var projectName = document.getElementById('rvModuleProject').value.trim();
    var moduleName = document.getElementById('rvModuleName').value.trim();
    if (!projectName) { showToast('请输入所属项目名称', 'error'); return; }
    if (!moduleName) { showToast('请输入所属模块名称', 'error'); return; }
    var cat = currentReviewFilter || 'pending';
    // 查找或创建项目（同分类下查找）
    var projects = getReviewProjects();
    var proj = projects.find(function(p) { return p.name === projectName && (p.category || 'pending') === cat; });
    if (!proj) {
        var projId = addReviewProject(projectName, cat);
        proj = { id: projId, name: projectName, category: cat };
    }
    addReviewModule(proj.id, moduleName, cat);
    closeModal('reviewModuleModal');
    showToast('模块添加成功', 'success');
    renderReviewView();
    renderSidebar();
}

function confirmDeleteReviewModule(id) {
    if (!confirm('确定要删除此审核模块吗？')) return;
    deleteReviewModule(id);
    showToast('模块已删除', 'success');
    renderReviewView();
    renderSidebar(); // 核心修复：立刻刷新左侧菜单，让它瞬间消失
}
function renderReviewTable() {
    var reviewTcs = getReviewTestcases();
    var statusFilter = currentReviewFilter || 'pending';
    var searchText = (document.getElementById('reviewSearchInput').value || '').trim().toLowerCase();
    var tbody = document.getElementById('reviewTableBody');

    var cases = reviewTcs.filter(function(tc) {
        var rs = getCaseReviewStatus(tc.id);
        if (statusFilter && rs !== statusFilter) return false;
        if (currentReviewProjectId && String(tc.projectId) !== currentReviewProjectId) return false;
        if (currentReviewModuleId && String(tc.moduleId) !== currentReviewModuleId) return false;
        if (searchText && tc.point && tc.point.toLowerCase().indexOf(searchText) === -1) return false;
        return true;
    });

    // 修改后：在 style 中增加了 border-bottom 属性
    if (cases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="empty-state" style="text-align:center; color:var(--text-secondary); padding:40px; border-bottom: 1px solid var(--border); border-top: 1px solid var(--border);">暂无匹配的审核用例</td></tr>';
        updateReviewBatchBar();
        return;
    }

    // 【新增分页计算】
    var total = cases.length; var maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > maxPage) currentPage = maxPage;
    var start = (currentPage - 1) * pageSize, end = Math.min(start + pageSize, total);
    var pageData = cases.slice(start, end);

    var html = '';
    pageData.forEach(function(tc, idx) {
        var displayId = start + idx + 1; // 连续的序号
        var checked = reviewSelectedIds.indexOf(tc.id) > -1 ? 'checked' : '';
        html += '<tr>';
        html += '<td class="checkbox-col"><input type="checkbox" ' + checked + ' onchange="toggleReviewCheck(\'' + tc.id + '\', this)"></td>';
        html += '<td>' + displayId + '</td>';
        html += '<td>' + esc(tc.projectName || '') + '</td>';
        html += '<td>' + esc(tc.moduleName || '') + '</td>';
        html += '<td>' + esc(tc.point || '') + '</td>';
        html += '<td><span class="badge badge-' + (tc.level || 'p3').toLowerCase() + '">' + esc(tc.level || 'P3') + '</span></td>';
        html += '<td style="white-space:pre-wrap; line-height:1.5;">' + formatSteps(tc.precondition) + '</td>';
        html += '<td style="white-space:pre-wrap; line-height:1.5;">' + formatSteps(tc.steps) + '</td>';
        html += '<td style="white-space:pre-wrap; line-height:1.5;">' + formatSteps(tc.expected) + '</td>';
        html += '<td>' + esc(tc.remark || '') + '</td>';
        html += '<td>' + esc(tc.creator || '') + '</td>';
        html += '<td class="actions">';
        html += '<button class="btn btn-small btn-secondary" onclick="editReviewCase(\'' + tc.id + '\')">编辑</button> ';
        html += '<button class="btn btn-small btn-danger" onclick="deleteReviewCase(\'' + tc.id + '\')">删除</button>';
        html += '</td>';
        html += '</tr>';
    });
    tbody.innerHTML = html;
    var rvPageInfo = document.getElementById('rvPageInfo');
    if(rvPageInfo) rvPageInfo.textContent = '显示 ' + (total ? start + 1 : 0) + '-' + end + ' 共 ' + total + ' 条';
    renderPageBtns(maxPage, 'rvPageBtns');
    updateReviewBatchBar();
}

function renderReviewBadge(status) {
    if (status === 'approved') return '<span class="badge" style="background:#dcfce7;color:#16a34a;">已通过</span>';
    if (status === 'rejected') return '<span class="badge" style="background:#fee2e2;color:#dc2626;">已驳回</span>';
    return '<span class="badge" style="background:#fff4e5;color:#d97706;">待审核</span>';
}

function reviewCase(caseId, status) {
    var rd = getReviewData();
    rd[caseId] = status;
    saveReviewData(rd);
    var msg = status === 'approved' ? '审核通过' : (status === 'rejected' ? '已驳回' : '已撤回');
    showToast(msg, 'success');
    renderReviewTable();
}

function toggleReviewCheck(caseId, el) {
    if (el.checked) {
        if (reviewSelectedIds.indexOf(caseId) === -1) reviewSelectedIds.push(caseId);
    } else {
        reviewSelectedIds = reviewSelectedIds.filter(function(id) { return id !== caseId; });
    }
    updateReviewBatchBar();
}

function toggleReviewCheckAll(el) {
    var checkboxes = document.querySelectorAll('#reviewTableBody input[type=checkbox]');
    reviewSelectedIds = [];
    if (el.checked) {
        checkboxes.forEach(function(cb) { cb.checked = true; });
        var reviewTcs = getReviewTestcases();
        var statusFilter = currentReviewFilter || 'pending';
        var searchText = (document.getElementById('reviewSearchInput').value || '').trim().toLowerCase();
        reviewTcs.forEach(function(tc) {
            var rs = getCaseReviewStatus(tc.id);
            if (statusFilter && rs !== statusFilter) return;
            if (currentReviewProjectId && String(tc.projectId) !== currentReviewProjectId) return;
            if (currentReviewModuleId && String(tc.moduleId) !== currentReviewModuleId) return;
            if (searchText && tc.point && tc.point.toLowerCase().indexOf(searchText) === -1) return;
            reviewSelectedIds.push(tc.id);
        });
    } else {
        checkboxes.forEach(function(cb) { cb.checked = false; });
    }
    updateReviewBatchBar();
}

function clearReviewSelection() {
    reviewSelectedIds = [];
    document.getElementById('reviewCheckAll').checked = false;
    var checkboxes = document.querySelectorAll('#reviewTableBody input[type=checkbox]');
    checkboxes.forEach(function(cb) { cb.checked = false; });
    updateReviewBatchBar();
}

function updateReviewBatchBar() {
    // batch bar removed, no-op
}

function editReviewCase(tcId) {
    var tcs = getReviewTestcases();
    var tc = tcs.find(function(t) { return t.id === tcId; });
    if (!tc) { showToast('用例不存在', 'error'); return; }
    document.getElementById('editRvCaseId').value = tcId;
    document.getElementById('editRvPoint').value = tc.point || '';
    document.getElementById('editRvLevel').value = tc.level || 'P3';
    document.getElementById('editRvPrecondition').value = tc.precondition || '';
    document.getElementById('editRvSteps').value = tc.steps || '';
    document.getElementById('editRvExpected').value = tc.expected || '';
    document.getElementById('editRvRemark').value = tc.remark || '';
    document.getElementById('editReviewCaseModal').classList.add('show');
}

function saveReviewCaseEdit() {
    var tcId = document.getElementById('editRvCaseId').value;
    var point = document.getElementById('editRvPoint').value.trim();
    if (!point) { showToast('测试点不能为空', 'error'); return; }
    var tcs = getReviewTestcases();
    var tc = tcs.find(function(t) { return t.id === tcId; });
    if (!tc) { showToast('用例不存在', 'error'); return; }
    tc.point = point;
    tc.level = document.getElementById('editRvLevel').value;
    tc.precondition = document.getElementById('editRvPrecondition').value;
    tc.steps = document.getElementById('editRvSteps').value;
    tc.expected = document.getElementById('editRvExpected').value;
    tc.remark = document.getElementById('editRvRemark').value;
    saveReviewTestcases(tcs);
    closeModal('editReviewCaseModal');
    showToast('用例已更新', 'success');
    renderReviewTable();
}

// 【修改】：智能版清道夫，只清理刚刚被搬空的模块，绝不误伤其他刚新建的空模块
function cleanUpEmptyReviewNodes(operatedModIds) {
    var mods = getReviewModules();
    var projs = getReviewProjects();
    var tcs = getReviewTestcases();

    // 核心：如果传入了刚刚被操作过的模块ID列表，我们就去专门检查它们
    if (operatedModIds && operatedModIds.length > 0) {
        var activeModKeys = {};
        // 找出所有还在审核区的用例，登记它们所属的模块
        tcs.forEach(function(tc) {
            activeModKeys[tc.moduleId] = true;
        });

        // 挨个检查刚刚被搬运的模块，如果它里面已经没有任何用例了，就把它删掉
        operatedModIds.forEach(function(modId) {
            if (!activeModKeys[modId]) {
                mods = mods.filter(function(m) { return String(m.id) !== String(modId); });
            }
        });
        saveReviewModules(mods);
    }

    // 仅检查当前停留的模块或项目是否被清理了
    // 如果被清理了，就清除本地的定位记忆，防止页面白屏
    var stillHasMod = mods.find(function(m) { return m.id === currentReviewModuleId; });
    if (!stillHasMod && currentReviewModuleId) {
        currentReviewModuleId = '';
        localStorage.removeItem('qa_rv_moduleId');
    }

    var stillHasProj = projs.find(function(p) { return p.id === currentReviewProjectId; });
    if (!stillHasProj && currentReviewProjectId) {
        currentReviewProjectId = '';
        localStorage.removeItem('qa_rv_projectId');
    }
}

function deleteReviewCase(tcId) {
    if (!confirm('确定要删除此用例吗？')) return;
    var tcs = getReviewTestcases();

    // 【新增】：在删除前，记住这个用例属于哪个模块
    var targetTc = tcs.find(function(t) { return t.id === tcId; });
    var operatedModId = targetTc ? targetTc.moduleId : null;

    tcs = tcs.filter(function(t) { return t.id !== tcId; });
    saveReviewTestcases(tcs);
    // 清理审核状态
    var rd = getReviewData();
    delete rd[tcId];
    saveReviewData(rd);
    // 从选中列表移除
    reviewSelectedIds = reviewSelectedIds.filter(function(id) { return id !== tcId; });
    showToast('用例已删除', 'success');

    // 【修改】：调用智能清道夫，传入刚才操作的模块ID
    cleanUpEmptyReviewNodes(operatedModId ? [operatedModId] : []);
    renderSidebar();

    // 【核心修复】：不要只刷新死板的表格，要刷新整个动态视图
    renderReviewView();
}

function openMoveReviewModal() {
    if (reviewSelectedIds.length === 0) { showToast('请先选择用例', 'error'); return; }
    // 默认选中"审核内流转"
    var radios = document.querySelectorAll('input[name="moveTarget"]');
    radios.forEach(function(r) { if (r.value === 'review') r.checked = true; });
    onMoveTargetChange();
    document.getElementById('moveReviewModal').classList.add('show');
}

// 替换第 1 个函数：控制界面显示的 onMoveTargetChange
function onMoveTargetChange() {
    var target = document.querySelector('input[name="moveTarget"]:checked').value;
    var container = document.getElementById('moveReviewFields');
    // 高亮选中的label
    var lbl1 = document.getElementById('moveTargetReview');
    var lbl2 = document.getElementById('moveTargetRepo');
    lbl1.style.borderColor = (target === 'review') ? 'var(--primary)' : 'var(--border)';
    lbl1.style.background = (target === 'review') ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : '';
    lbl2.style.borderColor = (target === 'repo') ? 'var(--primary)' : 'var(--border)';
    lbl2.style.background = (target === 'repo') ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : '';

    if (target === 'review') {
        var defaultModuleName = '';
        if (reviewSelectedIds.length > 0) {
            var tcs = getReviewTestcases();
            var firstSelectedCase = tcs.find(function(tc) { return tc.id === reviewSelectedIds[0]; });
            if (firstSelectedCase) {
                defaultModuleName = esc(firstSelectedCase.moduleName || '');
            }
        }

        var html = '';
        html += '<div class="form-row"><label class="required">目标分类</label><select id="moveCat"><option value="">请选择</option>';
        if (currentReviewFilter !== 'pending') html += '<option value="pending">待审核</option>';
        if (currentReviewFilter !== 'rejected') html += '<option value="rejected">未通过</option>';
        html += '</select></div>';
        html += '<div class="form-row"><label class="required">目标模块</label><input type="text" id="moveModReviewName" placeholder="请输入模块名称" value="' + defaultModuleName + '"></div>';
        container.innerHTML = html;
    } else {
        // 【核心修改区】：移动至仓库，改为 input + datalist，既能下拉又能手打必填项
        var data = getData();
        var defaultProjName = '';
        var defaultModName = '';

        // 智能回显：尝试读取你勾选的第一个用例的项目名和模块名
        if (reviewSelectedIds.length > 0) {
            var tcs = getReviewTestcases();
            var firstCase = tcs.find(function(tc) { return tc.id === reviewSelectedIds[0]; });
            if (firstCase) {
                defaultProjName = esc(firstCase.projectName || '');
                defaultModName = esc(firstCase.moduleName || '');
            }
        }

        var html = '';
        // 目标项目输入框（必填项）
        html += '<div class="form-row"><label class="required">目标项目</label>';
        html += '<input type="text" id="moveProjRepoInput" list="moveProjList" placeholder="请下拉选择或手动输入新项目" value="' + defaultProjName + '" oninput="onMoveProjRepoInputChange()" onchange="onMoveProjRepoInputChange()">';
        html += '<datalist id="moveProjList">';
        data.projects.forEach(function(p) { html += '<option value="'+esc(p.name)+'"></option>'; });
        html += '</datalist></div>';

        // 目标模块输入框（必填项）
        html += '<div class="form-row"><label class="required">目标模块</label>';
        html += '<input type="text" id="moveModRepoInput" list="moveModList" placeholder="请下拉选择或手动输入新模块" value="' + defaultModName + '">';
        html += '<datalist id="moveModList"></datalist></div>';

        container.innerHTML = html;
        // 手动触发一次联动，渲染模块列表
        onMoveProjRepoInputChange();
    }
}

function onMoveCatChange() {
    var cat = document.getElementById('moveCat').value;
    var projSel = document.getElementById('moveProjReview');
    var modSel = document.getElementById('moveModReview');
    projSel.innerHTML = '<option value="">请选择项目</option>';
    modSel.innerHTML = '<option value="">请先选择项目</option>';
    if (!cat) return;
    var projects = getReviewProjects().filter(function(p) { return (p.category || 'pending') === cat; });
    projects.forEach(function(p) { projSel.innerHTML += '<option value="'+p.id+'">'+esc(p.name)+'</option>'; });
}

function onMoveProjReviewChange() {
    var projId = document.getElementById('moveProjReview').value;
    var modSel = document.getElementById('moveModReview');
    modSel.innerHTML = '<option value="">请选择模块</option>';
    if (!projId) return;
    var modules = getReviewModules().filter(function(m) { return String(m.projectId) === projId; });
    modules.forEach(function(m) { modSel.innerHTML += '<option value="'+m.id+'">'+esc(m.name)+'</option>'; });
}

// 替换第 2 个函数：智能联想下拉菜单数据
function onMoveProjRepoInputChange() {
    var projInput = document.getElementById('moveProjRepoInput');
    if (!projInput) return;
    var projName = projInput.value.trim();
    var modDataList = document.getElementById('moveModList');
    if (!modDataList) return;

    modDataList.innerHTML = ''; // 每次打字先清空旧列表
    if (!projName) return;

    var data = getData();
    // 根据用户当前输入的名字，去找仓库里有没有现成的项目
    var proj = data.projects.find(function(p) { return p.name === projName; });

    // 如果有现成的，就把它的模块拿出来当做下拉选项供选择
    if (proj && proj.modules) {
        proj.modules.forEach(function(m) {
            modDataList.innerHTML += '<option value="'+esc(m.name)+'"></option>';
        });
    }
}

// 替换第 3 个函数：执行移动核心逻辑（升级为 async 异步函数）
async function executeMoveReview() {
    var target = document.querySelector('input[name="moveTarget"]:checked').value;
    if (reviewSelectedIds.length === 0) { showToast('没有选中的用例', 'error'); return; }

    // 【新增核心】：在移动前，收集所有被勾选用例所属的模块ID，方便后续做智能清理
    var currentTcs = getReviewTestcases();
    var operatedModIds = [];
    currentTcs.forEach(function(tc) {
        if (reviewSelectedIds.indexOf(tc.id) > -1 && operatedModIds.indexOf(tc.moduleId) === -1) {
            operatedModIds.push(tc.moduleId);
        }
    });

    if (target === 'review') {
        // === 审核内流转逻辑 ===
        var cat = document.getElementById('moveCat').value;
        var modName = document.getElementById('moveModReviewName').value.trim();
        if (!cat) { showToast('请选择目标分类', 'error'); return; }
        if (!modName) { showToast('请输入目标模块名称', 'error'); return; }
        var currentProj = getReviewProjects().find(function(p) { return p.id === currentReviewProjectId; });
        var projName = currentProj ? currentProj.name : '默认项目';
        var projects = getReviewProjects().filter(function(p) { return (p.category || 'pending') === cat; });
        var proj = projects.find(function(p) { return p.name === projName; });
        if (!proj) {
            var newProjId = addReviewProject(projName, cat);
            proj = { id: newProjId, name: projName, category: cat };
        }
        var modules = getReviewModules().filter(function(m) { return String(m.projectId) === String(proj.id); });
        var mod = modules.find(function(m) { return m.name === modName; });
        if (!mod) {
            var newModId = addReviewModule(proj.id, modName, cat);
            mod = { id: newModId, projectId: proj.id, name: modName, category: cat };
        }
        var tcs = getReviewTestcases();
        var movedCount = 0;
        tcs.forEach(function(tc) {
            if (reviewSelectedIds.indexOf(tc.id) > -1) {
                tc.projectId = proj.id; tc.projectName = proj.name;
                tc.moduleId = mod.id; tc.moduleName = mod.name;
                movedCount++;
            }
        });
        saveReviewTestcases(tcs);
        var rd = getReviewData();
        reviewSelectedIds.forEach(function(id) { rd[id] = cat; });
        saveReviewData(rd);
        reviewSelectedIds = [];
        var checkAllBtn = document.getElementById('reviewCheckAll');
        if(checkAllBtn) checkAllBtn.checked = false;

        // 【核心修改】：传入被搬空的模块ID给清道夫
        cleanUpEmptyReviewNodes(operatedModIds);

        renderSidebar();
        closeModal('moveReviewModal');
        showToast('成功移动 ' + movedCount + ' 条用例至审核 - ' + (cat === 'pending' ? '待审核' : '未通过'), 'success');
        renderReviewView();

    } else {
        // === 移动至用例仓库逻辑 ===
        var projNameInput = document.getElementById('moveProjRepoInput').value.trim();
        var modNameInput = document.getElementById('moveModRepoInput').value.trim();

        if (!projNameInput || !modNameInput) {
            showToast('目标项目和模块为必填项！', 'error');
            return;
        }

        var confirmBtn = document.querySelector('#moveReviewModal .modal-footer .btn:last-child');
        confirmBtn.disabled = true;
        confirmBtn.textContent = '入库处理中...';

        try {
            var data = getData();
            var matchedProj = data.projects.find(function(p) { return p.name === projNameInput; });
            var finalProjId = matchedProj ? matchedProj.id : null;
            var matchedMod = null;

            if (matchedProj) {
                matchedMod = (matchedProj.modules || []).find(function(m) { return m.name === modNameInput; });
            }

            // 1. 如果仓库没这个项目，自动新建
            if (!matchedProj) {
                const resP = await authFetch('/api/project', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: projNameInput, desc: '由审核移动时自动创建' })
                });
                const dataP = await resP.json();
                if (!dataP.success) { throw new Error(dataP.message || '新项目自动创建失败'); }
                finalProjId = dataP.project.id;
            }

            // 2. 如果仓库没这个模块，自动新建
            if (!matchedMod) {
                const resM = await authFetch('/api/module', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: finalProjId, name: modNameInput })
                });
                const dataM = await resM.json();
                if (!dataM.success) { throw new Error(dataM.message || '新模块自动创建失败'); }
            }

            // 3. 重新同步数据获取最新 ID
            await fetchServerData();
            data = getData();
            matchedProj = data.projects.find(function(p) { return p.name === projNameInput; });
            matchedMod = (matchedProj.modules || []).find(function(m) { return m.name === modNameInput; });

            // 4. 准备两份独立副本
            var tcs = getReviewTestcases();
            var allNewCases = [];
            var remaining = [];

            tcs.forEach(function(tc) {
                if (reviewSelectedIds.indexOf(tc.id) > -1) {
                    // 副本 A
                    allNewCases.push({
                        projectId: matchedProj.id, projectName: matchedProj.name,
                        moduleId: matchedMod.id, moduleName: matchedMod.name,
                        point: tc.point, level: tc.level,
                        precondition: tc.precondition, steps: tc.steps,
                        expected: tc.expected, remark: tc.remark,
                        creator: tc.creator, status: '待测试',
                        assignedBy: '', executor: ''
                    });

                    // 副本 B
                    allNewCases.push({
                        projectId: matchedProj.id, projectName: matchedProj.name,
                        moduleId: matchedMod.id, moduleName: matchedMod.name,
                        point: tc.point, level: tc.level,
                        precondition: tc.precondition, steps: tc.steps,
                        expected: tc.expected, remark: tc.remark,
                        creator: currentUser.username,
                        status: '待测试',
                        assignedBy: '系统流转',
                        executor: ''
                    });
                } else {
                    remaining.push(tc);
                }
            });

            // 5. 物理入库
            if (allNewCases.length > 0) {
                const resAdd = await authFetch('/api/testcase/batch_add', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(allNewCases)
                });
                const resData = await resAdd.json();

                if (resData.success) {
                    saveReviewTestcases(remaining);
                    var rd = getReviewData();
                    reviewSelectedIds.forEach(function(id) { delete rd[id]; });
                    saveReviewData(rd);

                    reviewSelectedIds = [];
                    var checkAllBtn = document.getElementById('reviewCheckAll');
                    if(checkAllBtn) checkAllBtn.checked = false;

                    // 【核心修改】：传入被搬空的模块ID给清道夫
                    cleanUpEmptyReviewNodes(operatedModIds);

                    await fetchServerData();
                    renderSidebar();
                    closeModal('moveReviewModal');
                    showToast('入库成功：仓库与任务中心已物理隔离','success');
                    renderReviewView();
                } else {
                    throw new Error(resData.message || '入库失败');
                }
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '确认移动';
        }
    }
}

function batchReview(status) {
    if (reviewSelectedIds.length === 0) { showToast('请先选择用例', 'error'); return; }
    var rd = getReviewData();
    reviewSelectedIds.forEach(function(id) { rd[id] = status; });
    saveReviewData(rd);
    var msg = status === 'approved' ? '批量通过 ' + reviewSelectedIds.length + ' 条用例' : '批量驳回 ' + reviewSelectedIds.length + ' 条用例';
    showToast(msg, 'success');
    reviewSelectedIds = [];
    document.getElementById('reviewCheckAll').checked = false;
    renderReviewTable();
}

function renderTestCaseView() {
    // 1. 获取三个显示区域（项目列表、模块列表、用例列表）
    var v1 = document.getElementById('tc-view-projects');
    var v2 = document.getElementById('tc-view-modules');
    var v3 = document.getElementById('tc-view-cases');

    // 初始状态：全部隐藏
    v1.style.display = 'none'; v2.style.display = 'none'; v3.style.display = 'none';

    // 获取最新数据
    var data = getData();

    // 【核心新增】：在这里定义 activeProjects，只保留没被标记删除的项目
    var activeProjects = (data.projects || []).filter(function(p) {
        return p.isRepoDeleted !== true;
    });

    // 动态更新页面标题
    var displayTitle = '用例仓库';
    if(currentProject){
        var proj = data.projects.find(function(x){return String(x.id)===String(currentProject)});
        if(proj){
            displayTitle += ' - ' + proj.name;
            if(currentModule){
                var mod = (proj.modules||[]).find(function(x){return String(x.id)===String(currentModule)});
                if(mod) displayTitle += ' - ' + mod.name;
            }
        }
    }
    document.getElementById('pageTitle').textContent = displayTitle;

    // 情况 A：当前处于“用例仓库”首页，显示项目卡片
    if (!currentProject) {
        v1.style.display = 'block';
        var html = '';

        // 【核心修改】：判断 activeProjects 的长度，而不是原来的 data.projects
        if(!activeProjects.length){
            html = '<div class="empty-state" style="grid-column: 1/-1">暂无项目页签，请新建。</div>';
        } else {
            // 【核心修改】：循环渲染 activeProjects，这样被打标记的项目就不会在这里出现卡片了
            activeProjects.forEach(function(p){
                var modCount = (p.modules||[]).length;
                var isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
                var delBtnProj = isAdmin ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); deleteProject(\''+p.id+'\')">删除</button>' : '';
                var editBtnProj = '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditProjectModal(\''+p.id+'\', \''+esc(p.name).replace(/'/g,'\\\'')+'\')">重命名</button>';

                html += '<div class="grid-card" onclick="selectProject(\''+p.id+'\',\''+esc(p.name)+'\')">' +
                        editBtnProj + delBtnProj +
                        '<h3>' + hierarchyIcons.folder + ' ' + esc(p.name) + '</h3>' +
                        '<p style="margin-top:12px">当前包含 <strong>' + modCount + '</strong> 个二级测试模块</p>' +
                        '<div class="grid-card-footer">进入子页签 →</div></div>';
            });
        }
        document.getElementById('projectGrid').innerHTML = html;
    }
    // 情况 B：已选项目，展示模块卡片
    else if (currentProject && !currentModule) {
        var p = data.projects.find(function(x){return String(x.id)===String(currentProject)});
        if(!p || p.isRepoDeleted) {
            // 如果该项目已经被仓库标记删除了，强行退回项目列表页
            currentProject = ''; renderTestCaseView(); return;
        }
        v2.style.display = 'block';
        var html = '';

        // 【本次新增核心过滤】：先把被软删除的模块给剔除出去，形成一个干净的数组
        var activeModules = (p.modules||[]).filter(function(m) {
            return m.isRepoDeleted !== true;
        });

        // 判断这个干净的数组是否为空
        if(!activeModules.length){
            html = '<div class="empty-state" style="grid-column: 1/-1">当前页签下暂无测试模块，请点击右上角新建。</div>';
        } else {
            // 循环遍历干净的数组
            activeModules.forEach(function(m){
                var tcCount = (data.testcases||[]).filter(function(t){
                    // 过滤掉任务副本，只计算仓库原件
                    return String(t.moduleId)===String(m.id) && (!t.assignedBy || t.assignedBy === '');
                }).length;
                var isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
                var delBtnMod = isAdmin ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); deleteModule(\''+p.id+'\',\''+m.id+'\')">删除</button>' : '';
                var editBtnMod = '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditModuleModal(\''+p.id+'\', \''+m.id+'\', \''+esc(m.name).replace(/'/g,'\\\'')+'\')">重命名</button>';
                html += '<div class="grid-card" onclick="selectModule(\''+p.id+'\',\''+m.id+'\',\''+esc(m.name)+'\')">' +
                        editBtnMod + delBtnMod +
                        '<h3>' + hierarchyIcons.file + ' ' + esc(m.name) + '</h3>' +
                        '<p style="margin-top:12px">当前包含 <strong>' + tcCount + '</strong> 条测试用例</p>' +
                        '<div class="grid-card-footer">管理测试用例 →</div></div>';
            });
        }
        document.getElementById('moduleGrid').innerHTML = html;
    }
    // 情况 C：已选模块，展示用例列表
    else {
        v3.style.display = 'flex';
        renderTable();
    }
}

// 【新增核心功能】打开修改项目名称弹窗
function openEditProjectModal(id, name) {
    document.getElementById('editProjectId').value = id;
    document.getElementById('editProjectId').dataset.oldName = name; // 【新增】：把旧名字偷偷存进标签里
    document.getElementById('editProjectName').value = name;
    document.getElementById('editProjectModal').classList.add('show');
}

// 核心：处理项目重命名拦截
async function saveEditProject() {
    var id = document.getElementById('editProjectId').value;
    var newName = document.getElementById('editProjectName').value.trim();
    if (!newName) { showToast('名称不能为空', 'error'); return; }

    var isReview = String(id).startsWith('rp_');
    var targetType = isReview ? 'review_project' : 'project';

    // 拦截测试工程师的重命名操作
    if (currentUser && currentUser.role === 'tester') {
        var oldName = document.getElementById('editProjectId').dataset.oldName || '未知项目';
        var cnName = currentUser.chineseName || currentUser.username;
        try {
            const res = await authFetch('/api/message', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetType: targetType, targetId: id,
                    oldName: oldName, newName: newName, senderCn: cnName
                })
            });
            const result = await res.json();
            if (result.success) {
                closeModal('editProjectModal');
                showToast('已向管理员发送重命名申请，请等待审批', 'success');
                if (typeof fetchMessages === 'function') fetchMessages();
            } else { showToast(result.message, 'error'); }
        } catch(e) { showToast('请求异常', 'error'); }
        return; // 直接结束，不执行下方管理员的直接修改逻辑
    }

    // --- 以下是原有的管理员直接修改逻辑 ---
    if (isReview) {
        var projects = getReviewProjects();
        var proj = projects.find(function(p) { return p.id === id; });
        if (proj) {
            proj.name = newName;
            saveReviewProjects(projects);
            closeModal('editProjectModal');
            showToast('项目已重命名', 'success');
            renderReviewView(); renderSidebar();
        }
        return;
    }

    try {
        const res = await authFetch('/api/project/' + id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('editProjectModal');
            await fetchServerData(); // 重新拉取最新数据
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect(); renderTaskTable();
            showToast('项目重命名及关联用例更新成功', 'success');
        } else { showToast(result.message || '重命名失败', 'error'); }
    } catch (e) { showToast('请求异常', 'error'); }
}

// 【新增核心功能】打开修改模块名称弹窗
function openEditModuleModal(projId, modId, name) {
    document.getElementById('editModProjId').value = projId;
    document.getElementById('editModId').value = modId;
    document.getElementById('editModId').dataset.oldName = name; // 【新增】：把旧名字偷偷存进标签里
    document.getElementById('editModName').value = name;
    document.getElementById('editModuleModal').classList.add('show');
}

// 核心：处理模块重命名拦截
async function saveEditModule() {
    var modId = document.getElementById('editModId').value;
    var newName = document.getElementById('editModName').value.trim();
    if (!newName) { showToast('名称不能为空', 'error'); return; }

    var isReview = String(modId).startsWith('rm_');
    var targetType = isReview ? 'review_module' : 'module';

    // 拦截测试工程师的重命名操作
    if (currentUser && currentUser.role === 'tester') {
        var oldName = document.getElementById('editModId').dataset.oldName || '未知模块';
        var cnName = currentUser.chineseName || currentUser.username;
        try {
            const res = await authFetch('/api/message', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetType: targetType, targetId: modId,
                    oldName: oldName, newName: newName, senderCn: cnName
                })
            });
            const result = await res.json();
            if (result.success) {
                closeModal('editModuleModal');
                showToast('已向管理员发送重命名申请，请等待审批', 'success');
                if (typeof fetchMessages === 'function') fetchMessages();
            } else { showToast(result.message, 'error'); }
        } catch(e) { showToast('请求异常', 'error'); }
        return;
    }

    // --- 管理员直接修改逻辑 ---
    if(isReview) {
        var modules = getReviewModules();
        var mod = modules.find(function(m) { return m.id === modId; });
        if (mod) {
            mod.name = newName;
            saveReviewModules(modules);
            closeModal('editModuleModal');
            showToast('模块已重命名', 'success');
            renderReviewView(); renderSidebar();
        }
        return;
    }

    try {
        const res = await authFetch('/api/module/' + modId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('editModuleModal');
            await fetchServerData();
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect(); renderTaskTable();
            showToast('模块重命名及关联用例更新成功', 'success');
        } else { showToast(result.message || '重命名失败', 'error'); }
    } catch (e) { showToast('请求异常', 'error'); }
}

function openModuleModalCurrent() {
    if(!currentProject) { showToast('当前不在任何项目下','error'); return;}
    var data = getData();
    var p = data.projects.find(function(x){return String(x.id)===String(currentProject)});
    openModuleModal(p.id, p.name);
}

// 【前端修改 1】：用例仓库数据过滤器
function getFilteredCases(){
    var data=getData();
    var search=(document.getElementById('searchInput').value||'').toLowerCase();
    var level=document.getElementById('filterLevel').value;
    var status=document.getElementById('filterStatus').value;

    return (data.testcases||[]).filter(function(tc){
        // 【关键】：只有 assignedBy 为空的，才是仓库原件；有了 assignedBy 的那是任务分身，不能在仓库展示！
        if(tc.assignedBy && tc.assignedBy.trim() !== '') return false;

        var match=true;
        if(search&&String(tc.point||'').toLowerCase().indexOf(search)===-1) match=false;
        if(level&&tc.level!==level) match=false;
        if(status&&tc.status!==status) match=false;
        if(String(tc.projectId)!==String(currentProject)) match=false;
        if(String(tc.moduleId)!==String(currentModule)) match=false;
        return match;
    })
}

// 【前端修改 2】：任务中心专属的“虚拟层级树”生成器
function getTaskTree(data, filterType) {
    var tree = {};
    (data.testcases || []).forEach(function(tc) {
        // 核心：只要有 assignedBy 标记的，统统属于任务中心的兵
        if (!tc.assignedBy || tc.assignedBy.trim() === '') return;

        var match = false;
        if (filterType === 'myCreate' && tc.creator === currentUser.username) match = true;
        if (filterType === 'myCharge' && tc.executor === currentUser.username) match = true;
        if (filterType === 'myAssign' && tc.assignedBy === currentUser.username) match = true;
        if (filterType === 'completed' && (tc.status === '通过' || tc.status === '未通过')) match = true;

        if (match) {
            var pId = tc.projectId, pName = tc.projectName || '未知项目';
            var mId = tc.moduleId, mName = tc.moduleName || '未知模块';

            if (!tree[pId]) tree[pId] = { id: pId, name: pName, modules: {} };
            if (!tree[pId].modules[mId]) tree[pId].modules[mId] = { id: mId, name: mName, count: 0 };
            tree[pId].modules[mId].count++;
        }
    });

    // 把对象转成数组返回给页面渲染
    return Object.values(tree).map(function(p) {
        return { id: p.id, name: p.name, modules: Object.values(p.modules) };
    });
}

function renderTableHeader(){
    var tr=document.querySelector('#tableHead tr');
    var html='';
    if(isColumnVisible('col-checkbox')){
        var visibleIds=getFilteredCases().map(function(x){return x.id});
        var allChecked=visibleIds.length&&visibleIds.every(function(id){return selectedCases.indexOf(id)!==-1})?'checked':'';
        html+='<th class="checkbox-col" style="width:40px; min-width:40px;"><input type="checkbox" '+allChecked+' onchange="toggleSelectAll(this.checked)"></th>'
    }
    if(isColumnVisible('col-id'))html+='<th style="width:60px; min-width:60px;">序号</th>';
    if(isColumnVisible('col-module'))html+='<th style="width:120px; min-width:120px;">模块</th>';
    if(isColumnVisible('col-point'))html+='<th style="width:200px; min-width:200px;">测试点</th>';
    if(isColumnVisible('col-level'))html+='<th style="width:80px; min-width:80px;">等级</th>';
    if(isColumnVisible('col-precondition'))html+='<th style="width:150px; min-width:150px;">前置条件</th>';
    if(isColumnVisible('col-steps'))html+='<th style="width:200px; min-width:200px;">操作步骤</th>';
    if(isColumnVisible('col-expected'))html+='<th style="width:200px; min-width:200px;">预期结果</th>';
    if(isColumnVisible('col-remark'))html+='<th style="width:120px; min-width:120px;">备注</th>';
    if(isColumnVisible('col-creator'))html+='<th style="width:80px; min-width:80px;">创建人</th>';
    // 这里已经被彻底移除了执行人和状态的表头
    if(isColumnVisible('col-actions'))html+='<th style="width:130px; min-width:130px; position:sticky; right:0;">操作</th>';
    tr.innerHTML=html;
}

function renderTable(){
    var filtered=getFilteredCases();renderTableHeader();
    var total=filtered.length;var maxPage=Math.max(1,Math.ceil(total/pageSize));
    if(currentPage>maxPage)currentPage=maxPage;
    var start=(currentPage-1)*pageSize,end=Math.min(start+pageSize,total),pageData=filtered.slice(start,end);
    var html='';
    pageData.forEach(function(tc, index){
        var displayId = start + index + 1;
        var levelClass = tc.level === 'P0' ? 'badge-p0' : (tc.level === 'P1' ? 'badge-p1' : (tc.level === 'P2' ? 'badge-p2' : 'badge-p3'));

        html+='<tr>';
        if(isColumnVisible('col-checkbox'))html+='<td class="checkbox-col"><input type="checkbox" '+(selectedCases.indexOf(tc.id)!==-1?'checked':'')+' onchange="toggleCaseSelection('+tc.id+')"></td>';
        if(isColumnVisible('col-id'))html+='<td>'+displayId+'</td>';
        if(isColumnVisible('col-module'))html+='<td>'+esc(tc.moduleName||'-')+'</td>';
        if(isColumnVisible('col-point'))html+='<td>'+esc(tc.point)+'</td>';
        if(isColumnVisible('col-level'))html+='<td><span class="badge '+levelClass+'">'+tc.level+'</span></td>';
        if(isColumnVisible('col-precondition'))html+='<td style="white-space:pre-wrap;max-width:180px; font-size:13px; color:var(--text-secondary);">'+formatSteps(tc.precondition)+'</td>';
        if(isColumnVisible('col-steps'))html+='<td style="white-space:pre-wrap;max-width:220px; font-size:13px; line-height:1.5;">'+formatSteps(tc.steps)+'</td>';
        if(isColumnVisible('col-expected'))html+='<td style="white-space:pre-wrap;max-width:220px; font-size:13px; line-height:1.5;">'+formatSteps(tc.expected)+'</td>';
        if(isColumnVisible('col-remark'))html+='<td style="font-size:13px;">'+esc(tc.remark||'-')+'</td>';
        if(isColumnVisible('col-creator'))html+='<td style="font-size:13px;">'+esc(tc.creator||'-')+'</td>';
        // 这里的数据绑定块也被清除了
        if(isColumnVisible('col-actions')){
            html+='<td class="actions">';
            if(hasPermission('edit_case'))html+='<button class="btn btn-small btn-primary" onclick="openCorrectModal('+tc.id+')">修正</button> ';
            if(hasPermission('delete_case'))html+='<button class="btn btn-small btn-danger" onclick="deleteTestCase('+tc.id+')">删除</button>';
            html+='</td>'
        }
        html+='</tr>';
    });
    // 【细节修改】：因为少了两列，所以暂无数据时的 colspan 合并单元格也要从 13 改为 11，防止排版错乱
    document.getElementById('tableBody').innerHTML = html || '<tr><td colspan="11" class="empty-state" style="border-bottom: 1px solid var(--border); border-top: 1px solid var(--border);">暂无符合条件的用例</td></tr>';
    document.getElementById('pageInfo').textContent='显示 '+(total?start+1:0)+'-'+end+' 共 '+total+' 条';
    renderPageBtns(Math.ceil(total/pageSize)||1, 'pageBtns');updateBatchActions();
}

function renderPageBtns(totalPages, containerId){var html='<button class="page-btn" onclick="changePage(-1)" '+(currentPage<=1?'disabled':'')+'>上一页</button>';for(var i=1;i<=totalPages;i++){if(i===1||i===totalPages||(i>=currentPage-2&&i<=currentPage+2))html+='<button class="page-btn '+(i===currentPage?'active':'')+'" onclick="goPage('+i+')">'+i+'</button>';else if(i===currentPage-3||i===currentPage+3)html+='<span>...</span>'}html+='<button class="page-btn" onclick="changePage(1)" '+(currentPage>=totalPages?'disabled':'')+'>下一页</button>';document.getElementById(containerId).innerHTML=html}
function triggerCurrentTableRender() {
    if (currentTab === 'testcases') renderTable();
    else if (currentTab === 'review') renderReviewTable();
    else if (currentTab === 'tasks') { var data = getData(); renderTaskTableContent(data); }
}
function changePage(delta){currentPage+=delta; localStorage.setItem('qa_currentPage', currentPage); triggerCurrentTableRender();}
function goPage(page){currentPage=page; localStorage.setItem('qa_currentPage', currentPage); triggerCurrentTableRender();}
function changePageSize(){
    var val = window.event && window.event.target ? window.event.target.value : document.getElementById('pageSize').value;
    pageSize=parseInt(val,10);
    var data=getData();
    if(!data.settings)data.settings={};
    if(!data.settings.basic)data.settings.basic={};
    data.settings.basic.sysPageSize=String(pageSize);
    setData(data);
    currentPage=1;
    localStorage.setItem('qa_currentPage', currentPage);
    if(document.getElementById('pageSize')) document.getElementById('pageSize').value = pageSize;
    if(document.getElementById('rvPageSize')) document.getElementById('rvPageSize').value = pageSize;
    if(document.getElementById('taskPageSize')) document.getElementById('taskPageSize').value = pageSize;
    triggerCurrentTableRender();
}
function toggleColumnSetting(e){e.stopPropagation();document.getElementById('columnDropdown').classList.toggle('show')}

function toggleCaseSelection(id){
    var idx=selectedCases.indexOf(id);
    if(idx===-1) selectedCases.push(id);
    else selectedCases.splice(idx,1);
    updateBatchActions();
    renderTableHeader();
}

function toggleSelectAll(checked){
    if(checked){
        selectedCases=getFilteredCases().map(function(x){return x.id});
    }else{
        selectedCases=[];
    }
    updateBatchActions();
    renderTable();
}

function updateBatchActions(){
    var bar=document.getElementById('batchActions');
    if(selectedCases.length){
        bar.style.display='flex';
        document.getElementById('selectedCount').textContent=selectedCases.length;
        var btnDel = document.getElementById('btnBatchDelete');
        if(btnDel) btnDel.style.display = hasPermission('batch_delete_case') ? 'inline-block' : 'none';
    }else{
        bar.style.display='none';
    }
}
function clearSelection(){selectedCases=[];updateBatchActions();renderTable()}

// 2. 批量删除选中的用例
async function deleteSelectedCases(){
    if(!selectedCases.length) return;
    if(!confirm('🚨 危险操作：确定要彻底删除选中的 ' + selectedCases.length + ' 条用例吗？\n删除后不可恢复！')) return;

    try {
        const res = await authFetch('/api/testcase/batch', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ids: selectedCases})
        });
        const result = await res.json();
        if(result.success){
            selectedCases = []; clearSelection();
            await fetchServerData();
            renderTestCaseView(); renderTaskTable(); updateStats(); renderCharts();
            showToast('批量删除成功', 'success');
        }
    } catch(e) { showToast('批量删除异常', 'error'); }
}

function openAssignModal(){if(!selectedCases.length){showToast('请先选择要分配的用例','error');return}var data=getData();var html='<option value="">请选择执行人</option>';data.users.forEach(function(u){html+='<option value="'+u.username+'">'+u.chineseName+' ('+u.username+')</option>'});document.getElementById('assignExecutor').innerHTML=html;document.getElementById('assignCount').textContent=selectedCases.length;document.getElementById('assignModal').classList.add('show')}

// 3. 确认分配执行人
async function confirmAssign(){
    var executor = document.getElementById('assignExecutor').value;
    if(!executor){showToast('请选择执行人','error');return}

    try {
        const res = await authFetch('/api/testcase/assign', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ids: selectedCases,  // 【关键修复 1】：用例仓库勾选的数据池是 selectedCases，不是 taskSelectedCases
                executor: executor,  // 【关键修复 2】：传递真正选中的执行人，不能传空字符串
                assignedBy: currentUser.username // 【关键修复 3】：告诉后端是谁分配的，用来触发克隆魔法
            })
        });
        const result = await res.json();

        if(result.success){
            closeModal('assignModal');
            clearSelection();
            // 【关键修复 4】：重新向服务器拉取包含刚生成的“克隆分身”的最新数据
            await fetchServerData();

            renderTaskTable();
            renderTestCaseView();
            // 【关键修复 5】：立刻刷新左侧导航树，让二级项目和三级模块瞬间出现！
            renderSidebar();

            showToast('任务分配成功！已同步至任务中心','success');
        } else {
            showToast(result.message || '分配失败', 'error');
        }
    } catch(e) {
        showToast('分配异常', 'error');
    }
}

function fillProjectAndModuleSelect(projectElId,moduleElId,selectedProjectId,selectedModuleId){var data=getData(),p=document.getElementById(projectElId),m=document.getElementById(moduleElId);var pHtml='<option value="">请选择项目</option>';data.projects.forEach(function(proj){pHtml+='<option value="'+proj.id+'">'+esc(proj.name)+'</option>'});p.innerHTML=pHtml;p.value=selectedProjectId||'';function fillModules(){var proj=data.projects.find(function(x){return String(x.id)===String(p.value)});var mHtml='<option value="">请选择模块</option>';((proj&&proj.modules)||[]).forEach(function(mod){mHtml+='<option value="'+mod.id+'">'+esc(mod.name)+'</option>'});m.innerHTML=mHtml;if(selectedModuleId)m.value=selectedModuleId||''}p.onchange=function(){selectedModuleId='';fillModules()};fillModules()}

function openTestModal(){document.getElementById('testModalTitle').textContent='新增测试用例';document.getElementById('testId').value='';fillProjectAndModuleSelect('testProject','testModule',currentProject||'',currentModule||'');document.getElementById('testPoint').value='';document.getElementById('testLevel').value='P1';document.getElementById('testPrecondition').value='';document.getElementById('testSteps').value='';document.getElementById('testExpected').value='';document.getElementById('testRemark').value='';document.getElementById('testModal').classList.add('show')}
function editTestCase(id){var data=getData();var tc=data.testcases.find(function(x){return x.id===id});if(!tc)return;document.getElementById('testModalTitle').textContent='编辑测试用例';document.getElementById('testId').value=tc.id;fillProjectAndModuleSelect('testProject','testModule',tc.projectId,tc.moduleId);document.getElementById('testPoint').value=tc.point;document.getElementById('testLevel').value=tc.level;document.getElementById('testPrecondition').value=tc.precondition||'';document.getElementById('testSteps').value=tc.steps;document.getElementById('testExpected').value=tc.expected;document.getElementById('testRemark').value=tc.remark||'';document.getElementById('testModal').classList.add('show')}

// 【新增】：打开修正编辑框
function openCorrectModal(id) {
    var data = getData();
    var tc = data.testcases.find(function(x) { return x.id === id });
    if (!tc) return;

    // 绑定隐藏的用例 ID
    document.getElementById('correctCaseId').value = tc.id;
    // 额外存一份旧的测试点名称，用来发通知
    document.getElementById('correctCaseId').dataset.oldPoint = tc.point;

    // 渲染左侧：原用例（不可编辑）
    document.getElementById('origPoint').value = tc.point || '';
    document.getElementById('origLevel').value = tc.level || '';
    document.getElementById('origPrecondition').value = tc.precondition || '';
    document.getElementById('origSteps').value = tc.steps || '';
    document.getElementById('origExpected').value = tc.expected || '';
    document.getElementById('origRemark').value = tc.remark || '';

    // 渲染右侧：清空上一次填写的记录，默认为空
    document.getElementById('corrPoint').value = '';
    document.getElementById('corrLevel').value = '';
    document.getElementById('corrPrecondition').value = '';
    document.getElementById('corrSteps').value = '';
    document.getElementById('corrExpected').value = '';
    document.getElementById('corrRemark').value = '';

    // 显示弹窗
    document.getElementById('correctModal').classList.add('show');
}

// 【新增】：提交修正申请
async function submitCorrection() {
    var id = document.getElementById('correctCaseId').value;
    var oldPoint = document.getElementById('correctCaseId').dataset.oldPoint;

    // 获取右侧填写的数据
    var point = document.getElementById('corrPoint').value.trim();
    var level = document.getElementById('corrLevel').value;
    var precondition = document.getElementById('corrPrecondition').value.trim();
    var steps = document.getElementById('corrSteps').value.trim();
    var expected = document.getElementById('corrExpected').value.trim();
    var remark = document.getElementById('corrRemark').value.trim();

    // 构建修正数据体（只有填了的才放入数据体）
    var correctionData = {};
    if (point) correctionData.point = point;
    if (level) correctionData.level = level;
    if (precondition) correctionData.precondition = precondition;
    if (steps) correctionData.steps = steps;
    if (expected) correctionData.expected = expected;
    if (remark) correctionData.remark = remark;

    // 校验：如果完全没填，就提示用户
    if (Object.keys(correctionData).length === 0) {
        showToast('您尚未填写任何修正内容', 'error');
        return;
    }

    var cnName = currentUser.chineseName || currentUser.username;

    try {
        const res = await authFetch('/api/message', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetType: 'testcase',
                targetId: id,
                oldName: oldPoint,
                newName: '修正申请', // 占位符
                senderCn: cnName,
                correctionPayload: JSON.stringify(correctionData) // 将修正后的 JSON 对象转成字符串传给后端
            })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('correctModal');
            showToast('已向管理员发送修正审批消息', 'success');
            if (typeof fetchMessages === 'function') fetchMessages();
        } else {
            showToast(result.message || '申请失败', 'error');
        }
    } catch(e) {
        showToast('请求异常，请检查网络连接', 'error');
    }
}

// 5. 保存/新增测试用例 (强化版)
async function saveTestCase(){
    var id = document.getElementById('testId').value;
    var projectId = document.getElementById('testProject').value;
    var moduleId = document.getElementById('testModule').value;
    var point = document.getElementById('testPoint').value.trim();

    if(!projectId || !moduleId){ showToast('请先选择项目和模块','error'); return; }
    if(!point){ showToast('请输入测试点','error'); return; }

    var data = getData();
    // 匹配当前选择的项目和模块信息
    var proj = data.projects.find(function(x){ return String(x.id) === String(projectId); });
    var mod = null;
    if (proj && proj.modules) {
        mod = proj.modules.find(function(x){ return String(x.id) === String(moduleId); });
    }

    // 【关键加固3】：在发送给后端前，将 ID 显式转为 Int 数字格式
    var payload = {
        id: id || null,
        projectId: parseInt(projectId, 10),
        projectName: proj ? proj.name : '',
        moduleId: parseInt(moduleId, 10),
        moduleName: mod ? mod.name : '',
        point: point,
        level: document.getElementById('testLevel').value,
        precondition: document.getElementById('testPrecondition').value,
        steps: document.getElementById('testSteps').value,
        expected: document.getElementById('testExpected').value,
        remark: document.getElementById('testRemark').value,
        creator: currentUser.username
    };

    try {
        const res = await authFetch('/api/testcase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // 捕获 500 等服务器错误，避免无声失败
        if (!res.ok) {
            showToast('服务器报错，状态码: ' + res.status, 'error');
            return;
        }

        const result = await res.json();

        if(result.success){
            closeModal('testModal');
            showToast('用例保存成功','success');
            await fetchServerData(); // 拉取最新数据
            renderTestCaseView();
            renderTaskTable();
            updateStats();
            renderCharts();
        } else {
            showToast(result.message || '保存失败', 'error');
        }
    } catch(e) {
        showToast('请求异常，请查看控制台', 'error');
        console.error("saveTestCase Error:", e);
    }
}

// 6. 删除测试用例
async function deleteTestCase(id){
    if(!confirm('确定删除此用例？删除后无法恢复！'))return;
    try {
        const res = await authFetch('/api/testcase/' + id, { method: 'DELETE' });
        const result = await res.json();
        if(result.success){
            selectedCases=selectedCases.filter(function(x){return x!==id});
            await fetchServerData();
            renderTestCaseView(); renderTaskTable(); updateStats(); renderCharts();
            showToast('删除成功','success');
        }
    } catch(e) { showToast('删除异常','error'); }
}

// 1. 更新用例状态
async function updateStatus(id, status){
    try {
        const res = await authFetch(`/api/testcase/${id}/status`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: status})
        });
        const result = await res.json();
        if(result.success){
            await fetchServerData(); // 重新拉取数据
            renderTestCaseView(); renderTaskTable(); renderCharts(); updateStats();
            showToast('状态更新成功','success');
        }
    } catch(e) { showToast('状态更新异常', 'error'); }
}

function openProjectModal(){document.getElementById('projectName').value='';document.getElementById('projectDesc').value='';document.getElementById('projectModal').classList.add('show')}
// 1. 新增项目
async function addProject(){
    var name=document.getElementById('projectName').value.trim(), desc=document.getElementById('projectDesc').value.trim();
    if(!name){showToast('请输入项目名称','error');return}
    try {
        const res = await authFetch('/api/project', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, desc: desc })
        });
        const result = await res.json();
        if(result.success) {
            closeModal('projectModal'); showToast('添加成功','success');
            await fetchServerData(); // 重新拉取后端数据
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect();
        } else { showToast(result.message, 'error'); }
    } catch(e) { showToast('请求异常','error'); }
}

// 2. 删除项目
async function deleteProject(projectId){
    if(!confirm('确定删除此项目及其下所有模块和用例？（后端将永久删除）'))return;
    try {
        const res = await authFetch('/api/project/' + projectId, { method: 'DELETE' });
        const result = await res.json();
        if(result.success) {
            if(currentProject===String(projectId)){clearCaseSelectionState()}
            await fetchServerData(); // 重新拉取后端数据
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect(); renderTaskTable(); updateStats(); renderCharts();
            showToast('项目删除成功','success');
        }
    } catch(e) { showToast('删除失败','error'); }
}

function openModuleModal(projectId,projectName){document.getElementById('moduleProjectId').value=projectId;document.getElementById('moduleProjectSelect').innerHTML='<option value="'+projectId+'">'+esc(projectName)+'</option>';document.getElementById('moduleName').value='';document.getElementById('moduleModal').classList.add('show')}
// 3. 新增模块
async function addModule(){
    var projectId=document.getElementById('moduleProjectId').value,
        name=document.getElementById('moduleName').value.trim();

    if(!name){showToast('请输入模块名称','error');return}

    try {
        const res = await authFetch('/api/module', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: projectId, name: name })
        });
        const result = await res.json();

        if(result.success){
            closeModal('moduleModal');
            showToast('模块添加成功','success');
            await fetchServerData(); // 重新向服务器拉取数据
            renderSidebar();
            renderTestCaseView();
            populateGeneratorProjectSelect();
        } else {
            // 如果后端拦截了，显示后端的错误信息
            showToast(result.message || '添加失败', 'error');
        }
    } catch(e) {
        showToast('请求异常，请检查后端终端报错信息','error');
        console.error(e);
    }
}

// 4. 删除模块
async function deleteModule(projectId,moduleId){
    if(!confirm('确定删除此模块及其所有用例？'))return;
    try {
        const res = await authFetch('/api/module/' + moduleId, { method: 'DELETE' });
        const result = await res.json();
        if(result.success){
            if(currentModule===String(moduleId)){currentModule='';}
            await fetchServerData();
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect(); renderTaskTable(); updateStats(); renderCharts();
            showToast('模块删除成功','success');
        }
    } catch(e) { showToast('删除失败','error'); }
}

// 【前端修改 4】：任务中心主控引擎 (虚拟层级版)
function renderTaskTable(){
    var vProj = document.getElementById('task-view-projects');
    var vMod = document.getElementById('task-view-modules');
    var vList = document.getElementById('task-view-list');
    var data = getData();

    var filterNames = {'myCharge':'我负责的','myCreate':'我创建的','myAssign':'我分配的','completed':'已完成'};
    var displayTitle = '任务中心 - ' + (filterNames[currentTaskFilter] || '');

    // 获取当前标签下的虚拟树结构
    var taskTree = getTaskTree(data, currentTaskFilter);
    var currentProjObj = taskTree.find(function(p){ return String(p.id) === currentTaskProject });

    if(currentProjObj){
        displayTitle += ' - ' + currentProjObj.name;
        if(currentTaskModule){
            var currentModObj = currentProjObj.modules.find(function(m){ return String(m.id) === currentTaskModule });
            if(currentModObj) displayTitle += ' - ' + currentModObj.name;
        }
    }

    var pageTitleEl = document.getElementById('pageTitle');
    var taskTitleEl = document.getElementById('taskTitle');
    if(pageTitleEl) pageTitleEl.textContent = displayTitle;
    if(taskTitleEl) taskTitleEl.textContent = displayTitle;

    var taskToolbar = document.getElementById('taskToolbar');
    if (taskToolbar) {
        taskToolbar.style.display = (currentTaskFilter === 'myCharge' && currentTaskModule) ? 'block' : 'none';
    }

    // 第一层：没选项目，展示【项目卡片】
    if (!currentTaskProject) {
        vProj.style.display = 'block'; vMod.style.display = 'none'; vList.style.display = 'none';
        var html = '';
        taskTree.forEach(function(proj) {
            var isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
            var delBtnProj = isAdmin ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); removeTaskItem(\'project\', \''+currentTaskFilter+'\', \''+proj.id+'\', \'\')">删除</button>' : '';
            var editBtnProj = '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditProjectModal(\''+proj.id+'\', \''+esc(proj.name).replace(/'/g,'\\\'')+'\')">重命名</button>';

            html += '<div class="grid-card" onclick="selectTaskSubItem(\''+currentTaskFilter+'\', \''+proj.id+'\', \'\')">' +
                    delBtnProj +
                    '<h3>' + hierarchyIcons.folder + ' ' + esc(proj.name) + '</h3>' +
                    '<p style="margin-top:12px">点击进入查看该项目下的模块</p>' +
                    '<div class="grid-card-footer">进入项目 →</div></div>';
        });
        document.getElementById('taskProjectGrid').innerHTML = html || '<div class="empty-state">暂无相关项目数据</div>';

    // 第二层：选了项目没选模块，展示【模块卡片】
    } else if (currentTaskProject && !currentTaskModule) {
        vProj.style.display = 'none'; vMod.style.display = 'block'; vList.style.display = 'none';
        var html = '';
        if(currentProjObj) {
            currentProjObj.modules.forEach(function(mod) {
                var isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
                var delBtnMod = isAdmin ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); removeTaskItem(\'module\', \''+currentTaskFilter+'\', \''+currentProjObj.id+'\', \''+mod.id+'\')">删除</button>' : '';
                var editBtnMod = '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditModuleModal(\''+currentProjObj.id+'\', \''+mod.id+'\', \''+esc(mod.name).replace(/'/g,'\\\'')+'\')">重命名</button>';

                html += '<div class="grid-card" onclick="selectTaskSubItem(\''+currentTaskFilter+'\', \''+currentProjObj.id+'\', \''+mod.id+'\')">' +
                        delBtnMod +
                        '<h3>' + hierarchyIcons.file + ' ' + esc(mod.name) + '</h3>' +
                        '<p style="margin-top:12px">包含 <strong>' + mod.count + '</strong> 条任务用例</p>' +
                        '<div class="grid-card-footer">进入模块列表 →</div></div>';
            });
        }
        document.getElementById('taskModuleGrid').innerHTML = html || '<div class="empty-state">该项目下无相关模块数据</div>';

    // 第三层：展示【用例列表】
    } else {
        vProj.style.display = 'none'; vMod.style.display = 'none'; vList.style.display = 'flex';
        renderTaskTableContent(data);
    }
}

// 最终列表渲染函数
function renderTaskTableContent(data) {
    var search = (document.getElementById('taskSearchInput').value || '').toLowerCase();
    var filtered = (data.testcases || []).filter(function(tc) {
        var match = false;
        // 匹配当前左侧选中的大菜单
        if (currentTaskFilter === 'myCharge' && tc.executor === currentUser.username) match = true;
        else if (currentTaskFilter === 'myCreate' && tc.creator === currentUser.username) match = true;
        else if (currentTaskFilter === 'myAssign' && tc.assignedBy === currentUser.username) match = true;
        else if (currentTaskFilter === 'completed' && (tc.status === '通过' || tc.status === '未通过')) match = true;

        if (!match) return false;

        // --- 重新补全的操作列逻辑 ---
        if (currentTaskFilter === 'completed') {
            // “已完成”页签：显示我们辛苦调好的 26/04/16 格式时间
            let displayTime = tc.finishTime || tc.createTime || '-';
            html += '<td class="actions" style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">' + displayTime + '</td>';
        } else {
            // 其他页签（如你截图里的“我负责的”）：显示“编辑”按钮
            // 确保这一行被加上，你的按钮就回来了
            html += '<td class="actions"><button class="btn btn-small btn-primary" onclick="openCorrectModal(' + tc.id + ')">修正</button></td>';
        }

        html += '</tr>'; // 别忘了最后闭合这一行

        if (search && String(tc.point || '').toLowerCase().indexOf(search) === -1) match = false;
        return match;
    });

    var isMyCreate = (currentTaskFilter === 'myCreate');
    var isMyCharge = (currentTaskFilter === 'myCharge'); // 【新增】：判断当前是否在我负责的页面
    var thead = document.querySelector('#taskTable thead');

    // 构建表头行
    var headerHtml = '<tr>';
    // 【新增】：只有“我负责的”页面，才渲染全选的勾选框表头
    if (isMyCharge) {
        var visibleIds = filtered.map(function(x){return x.id});
        var allChecked = visibleIds.length && visibleIds.every(function(id){return taskSelectedCases.indexOf(id)!==-1}) ? 'checked' : '';
        headerHtml += '<th class="checkbox-col" style="width:40px; min-width:40px;"><input type="checkbox" ' + allChecked + ' onchange="toggleTaskCheckAll(this.checked)"></th>';
    }
    headerHtml += '<th style="width:60px; min-width:60px;">序号</th>' +
        '<th style="width:120px; min-width:120px;">项目</th>' +
        '<th style="width:120px; min-width:120px;">模块</th>' +
        '<th style="width:200px; min-width:200px;">测试点</th>' +
        '<th style="width:80px; min-width:80px;">等级</th>' +
        '<th style="width:150px; min-width:150px;">前置条件</th>' +
        '<th style="width:200px; min-width:200px;">操作步骤</th>' +
        '<th style="width:200px; min-width:200px;">预期结果</th>' +
        '<th style="width:80px; min-width:80px;">创建人</th>';

    // 只有在“我创建的”里面隐藏状态，其他页面显示状态（移除执行人列）
    if (!isMyCreate) {
        headerHtml += '<th style="width:100px; min-width:100px;">状态</th>';
    }

    // 如果是已完成页签，表头显示“完成时间”
    var actionTitle = (currentTaskFilter === 'completed') ? '完成时间' : '操作';
    headerHtml += '<th style="width:130px; min-width:130px; position:sticky; right:0;">' + actionTitle + '</th></tr>';
    thead.innerHTML = headerHtml;

    // 【新增分页计算】
    var total = filtered.length; var maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > maxPage) currentPage = maxPage;
    var start = (currentPage - 1) * pageSize, end = Math.min(start + pageSize, total);
    var pageData = filtered.slice(start, end);

    // 构建数据行
    var html = '';
    pageData.forEach(function(tc, index) {
        var displayId = start + index + 1; // 连续的序号
        var levelClass = tc.level === 'P0' ? 'badge-p0' : (tc.level === 'P1' ? 'badge-p1' : (tc.level === 'P2' ? 'badge-p2' : 'badge-p3'));

        html += '<tr>';
        if (isMyCharge) {
            var checked = taskSelectedCases.indexOf(tc.id) !== -1 ? 'checked' : '';
            html += '<td class="checkbox-col"><input type="checkbox" ' + checked + ' onchange="toggleTaskCaseSelection(' + tc.id + ')"></td>';
        }
        html += '<td>' + displayId + '</td>' +
            '<td>' + esc(tc.projectName) + '</td>' +
            '<td>' + esc(tc.moduleName) + '</td>' +
            '<td>' + esc(tc.point) + '</td>' +
            '<td><span class="badge ' + levelClass + '">' + tc.level + '</span></td>' +
            '<td style="white-space:pre-wrap; font-size:13px; color:var(--text-secondary);">' + formatSteps(tc.precondition) + '</td>' +
            '<td style="white-space:pre-wrap;">' + formatSteps(tc.steps) + '</td>' +
            '<td style="white-space:pre-wrap;">' + formatSteps(tc.expected) + '</td>' +
            '<td>' + esc(tc.creator) + '</td>';

        if (!isMyCreate) {
            // 删除了执行人列，直接保留状态列
            // 状态列判断权限，有权限就给下拉框，没权限就给纯文本徽章
            if(hasPermission('update_status')){
                var sClass = tc.status === '通过' ? 'status-pass' : tc.status === '未通过' ? 'status-fail' : 'status-pending';
                html += '<td><select class="status-select ' + sClass + '" onchange="updateStatus('+tc.id+', this.value)">' +
                        '<option value="待测试" '+(tc.status==='待测试'?'selected':'')+'>待测试</option>' +
                        '<option value="通过" '+(tc.status==='通过'?'selected':'')+'>通过</option>' +
                        '<option value="未通过" '+(tc.status==='未通过'?'selected':'')+'>未通过</option>' +
                        '</select></td>';
            } else {
                var staticStatusClass = tc.status==='通过'?'badge-p3':tc.status==='未通过'?'badge-p1':'badge-p2';
                html += '<td><span class="badge '+staticStatusClass+'">'+tc.status+'</span></td>';
            }
        }

        // --- 替换 main.js 中 renderTaskTableContent 函数内部的最后一段逻辑 ---

        // 判断操作列显示什么
        if (currentTaskFilter === 'completed') {
            let rawTime = tc.finishTime || tc.createTime || '';
            let finalDisplay = '-';

            if (rawTime) {
                // 【核心修复】：智能多重解析引擎，通杀后端发来的任何时间格式！
                let d = new Date(rawTime);
                let rawStr = String(rawTime).trim();

                // 场景 A：如果后端（Flask）擅自把它变成了 "Fri, 17 Apr 2026 10:02:04 GMT" 这种格式
                if (!isNaN(d.getTime()) && rawStr.indexOf('GMT') !== -1) {
                    // 绝招：它其实就是后端当时存的本地时间，只是被强行标成了 GMT。
                    // 所以我们直接用 getUTC* 系列方法，把隐藏在里面的真实数字原封不动地抠出来！
                    let yy = String(d.getUTCFullYear()).slice(-2);
                    let mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                    let dd = String(d.getUTCDate()).padStart(2, '0');
                    let hh = String(d.getUTCHours()).padStart(2, '0');
                    let min = String(d.getUTCMinutes()).padStart(2, '0');
                    let ss = String(d.getUTCSeconds()).padStart(2, '0');
                    finalDisplay = yy + '/' + mm + '/' + dd + ' ' + hh + ':' + min + ':' + ss;
                }
                // 场景 B：传过来的是 "26/04/17 10:02:04" 或老数据只剩下 "26/04/17"
                else {
                    let parts = rawStr.split(/\s+/);
                    let datePart = parts[0] || '00/00/00';
                    let timePart = parts[1] || '00:00:00';

                    // 1. 强转日期部分 -> XX/XX/XX
                    datePart = datePart.replace(/-/g, '/');
                    let dArr = datePart.split('/');
                    if(dArr.length === 3) {
                        let yy = dArr[0].length === 4 ? dArr[0].slice(-2) : dArr[0].padStart(2, '0');
                        let mm = dArr[1].padStart(2, '0');
                        let dd = dArr[2].padStart(2, '0');
                        datePart = yy + '/' + mm + '/' + dd;
                    }

                    // 2. 强转时间部分 -> XX:XX:XX
                    let tArr = timePart.split(':');
                    let hh = (tArr[0] || '00').padStart(2, '0');
                    let min = (tArr[1] || '00').padStart(2, '0');
                    let ss = (tArr[2] || '00').padStart(2, '0');
                    timePart = hh + ':' + min + ':' + ss;

                    finalDisplay = datePart + ' ' + timePart;
                }
            }
            html += '<td class="actions" style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">' + finalDisplay + '</td>';
        } else {
            // 【重点修复】：我负责的、我分配的等其他页签，必须补上“编辑”按钮
            html += '<td class="actions"><button class="btn btn-small btn-primary" onclick="openCorrectModal(' + tc.id + ')">修正</button></td>';
        }

        html += '</tr>'; // 闭合这一行
    });

    var colspanCount = isMyCharge ? 11 : (isMyCreate ? 9 : 10);
    document.getElementById('taskTableBody').innerHTML = html || '<tr><td colspan="' + colspanCount + '" class="empty-state" style="border-bottom: 1px solid var(--border); border-top: 1px solid var(--border);">暂无相关数据</td></tr>';

    var taskPageInfo = document.getElementById('taskPageInfo');
    if (taskPageInfo) taskPageInfo.textContent = '显示 ' + (total ? start + 1 : 0) + '-' + end + ' 共 ' + total + ' 条';
    renderPageBtns(maxPage, 'taskPageBtns');
}

// ================= 新增：任务中心批量完成逻辑 =================
function toggleTaskCaseSelection(id) {
    var idx = taskSelectedCases.indexOf(id);
    if (idx === -1) taskSelectedCases.push(id);
    else taskSelectedCases.splice(idx, 1);
    updateTaskBatchActions();
    var data = getData();
    renderTaskTableContent(data); // 刷新表头全选状态
}

function toggleTaskCheckAll(checked) {
    var data = getData();
    var search = (document.getElementById('taskSearchInput').value || '').toLowerCase();
    var filtered = (data.testcases || []).filter(function(tc) {
        if (tc.executor !== currentUser.username) return false;
        if (currentTaskProject && String(tc.projectId) !== currentTaskProject) return false;
        if (currentTaskModule && String(tc.moduleId) !== currentTaskModule) return false;
        if (search && String(tc.point || '').toLowerCase().indexOf(search) === -1) return false;
        return true;
    });

    if (checked) {
        taskSelectedCases = filtered.map(function(x) { return x.id; });
    } else {
        taskSelectedCases = [];
    }
    updateTaskBatchActions();
    renderTaskTableContent(data);
}

function updateTaskBatchActions() {
    var bar = document.getElementById('taskBatchActions');
    if (!bar) return;
    if (taskSelectedCases.length > 0 && currentTaskFilter === 'myCharge') {
        bar.style.display = 'flex';
        document.getElementById('taskSelectedCount').textContent = taskSelectedCases.length;
    } else {
        bar.style.display = 'none';
    }
}

function clearTaskSelection() {
    taskSelectedCases = [];
    updateTaskBatchActions();
    var data = getData();
    renderTaskTableContent(data);
}

async function finishTaskCases() {
    var data = getData();
    var currentVisibleCases = data.testcases.filter(function(tc) {
        return tc.executor === currentUser.username &&
               String(tc.projectId) === currentTaskProject &&
               String(tc.moduleId) === currentTaskModule;
    });

    if (taskSelectedCases.length === 0) {
        showToast('操作拦截：请先勾选需要完成的用例！', 'error');
        return;
    }

    if (taskSelectedCases.length < currentVisibleCases.length) {
        showToast('操作拦截：必须全选当前模块下的用例才能点击已完成！', 'error');
        return;
    }

    var hasPending = false;
    taskSelectedCases.forEach(function(id) {
        var tc = data.testcases.find(function(t) { return t.id === id; });
        if (tc && tc.status === '待测试') hasPending = true;
    });

    if (hasPending) {
        showToast('操作拦截：仍有“待测试”用例，请先更新状态！', 'error');
        return;
    }

    if (!confirm('确定将当前模块的所有用例标记为已完成吗？')) return;

    // --- 【修复：生成北京时间字符串】 ---
    var now = new Date();
    // 抵消时区差，强制计算北京时间 (UTC+8)
    var bjTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));

    var yy = String(bjTime.getFullYear()).slice(-2);
    var mm = String(bjTime.getMonth() + 1).padStart(2, '0');
    var dd = String(bjTime.getDate()).padStart(2, '0');
    var hh = String(bjTime.getHours()).padStart(2, '0');
    var min = String(bjTime.getMinutes()).padStart(2, '0');
    var ss = String(bjTime.getSeconds()).padStart(2, '0');

    var finalFinishTime = yy + '/' + mm + '/' + dd + ' ' + hh + ':' + min + ':' + ss;

    try {
        const res = await authFetch('/api/testcase/assign', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ids: taskSelectedCases,
                executor: '',
                finishTime: finalFinishTime // 将这一秒的时间传给后端
            })
        });
        const result = await res.json();

        if (result.success) {
            taskSelectedCases = [];
            currentPage = 1;
            currentTaskFilter = 'completed';
            localStorage.setItem('qa_currentTaskFilter', 'completed');
            currentTaskProject = '';
            currentTaskModule = '';

            await fetchServerData();
            renderSidebar();
            renderTaskTable();
            updateStats();
            renderCharts();
            showToast('任务已标记完成，时间已精确记录', 'success');
        }
    } catch(e) {
        showToast('网络请求异常', 'error');
    }
}
function exportTestCases(){
    var data=getData();
    var rows=getFilteredCases().map(function(tc){return {'序号':tc.id,'模块':tc.moduleName||'-','测试点':tc.point,'等级':tc.level,'前置条件':tc.precondition||'','操作步骤':tc.steps,'预期结果':tc.expected,'备注':tc.remark||'','创建人':tc.creator||'','执行人':tc.executor||'','状态':tc.status}});
    var wb=XLSX.utils.book_new();var ws=XLSX.utils.json_to_sheet(rows);
    ws['!cols']=[{wch:8},{wch:15},{wch:28},{wch:8},{wch:20},{wch:40},{wch:40},{wch:18},{wch:14},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws,'当前模块测试用例');
    XLSX.writeFile(wb,'测试用例导出_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

// 导入 Excel 逻辑改造
function importReviewTestCases(){
    if(!currentReviewProjectId || !currentReviewModuleId){
        showToast('请先进入具体模块再导入', 'error');
        return;
    }
    var rvProjects = getReviewProjects();
    var rvModules = getReviewModules();
    var proj = rvProjects.find(function(p){ return p.id === currentReviewProjectId; });
    var mod = rvModules.find(function(m){ return m.id === currentReviewModuleId; });
    if(!proj || !mod){ showToast('未找到对应的审核项目或模块','error'); return; }

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = function(e){
        var file = e.target.files && e.target.files[0];
        if(!file){showToast('未选择文件','error');return;}
        showToast('正在读取文件，请稍候...','info');
        var reader = new FileReader();
        reader.onload = function(evt){
            try{
                var wb = XLSX.read(new Uint8Array(evt.target.result),{type:'array'});
                var imported = [];
                wb.SheetNames.forEach(function(sheetName){
                    var json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1, defval:''});
                    if(json.length<2) return;
                    var headerRowIdx = -1, map = {};
                    for(var r=0; r<Math.min(10, json.length); r++){
                        for(var c=0; c<json[r].length; c++){
                            var val = String(json[r][c]||'').replace(/\s+/g,'');
                            if(val==='测试点'||val==='用例名称'||val==='功能点'){ headerRowIdx=r; break; }
                        }
                        if(headerRowIdx!==-1){
                            json[r].forEach(function(h,i){ if(h) map[String(h).replace(/\s+/g,'')]=i; });
                            break;
                        }
                    }
                    if(headerRowIdx===-1) return;
                    var tpCol=map['测试点']!==undefined?map['测试点']:(map['功能点']!==undefined?map['功能点']:map['用例名称']);
                    var lvCol=map['等级']!==undefined?map['等级']:(map['危险等级']!==undefined?map['危险等级']:map['优先级']);
                    var preCol=map['前置条件']!==undefined?map['前置条件']:(map['基础基岩']!==undefined?map['基础基岩']:map['前提条件']);
                    var stepCol=map['操作步骤']!==undefined?map['操作步骤']:(map['模拟推导']!==undefined?map['模拟推导']:map['步骤']);
                    var expCol=map['预期结果']!==undefined?map['预期结果']:(map['标定落点']!==undefined?map['标定落点']:map['预期']);
                    var remCol=map['备注']!==undefined?map['备注']:map['说明'];
                    if(tpCol===undefined) return;
                    for(var r=headerRowIdx+1; r<json.length; r++){
                        var row=json[r];
                        if(!row||!row.length) continue;
                        var point=row[tpCol];
                        if(!point||!String(point).trim()) continue;
                        imported.push({
                            id: 'rv_tc_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),
                            projectId: proj.id, projectName: proj.name,
                            moduleId: mod.id, moduleName: mod.name,
                            point: String(point).trim(),
                            level: (lvCol!==undefined&&row[lvCol])?String(row[lvCol]).trim():'P3',
                            precondition: (preCol!==undefined&&row[preCol])?String(row[preCol]):'',
                            steps: (stepCol!==undefined&&row[stepCol])?String(row[stepCol]):'',
                            expected: (expCol!==undefined&&row[expCol])?String(row[expCol]):'',
                            remark: (remCol!==undefined&&row[remCol])?String(row[remCol]):'',
                            creator: currentUser ? currentUser.username : '',
                            status: '未执行'
                        });
                    }
                });
                if(imported.length>0){
                    var existing = getReviewTestcases();
                    saveReviewTestcases(existing.concat(imported));
                    renderReviewTable();
                    showToast('导入成功！共写入 '+imported.length+' 条审核用例。','success');
                } else {
                    showToast('未能导入任何有效数据，请检查文件格式','error');
                }
            }catch(err){console.error(err);showToast('导入失败，处理过程出错','error');}
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

function importTestCases(){
    if(!currentProject || !currentModule){
        showToast('异常：未定位到具体模块环境，请刷新页面', 'error');
        return;
    }

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = function(e){
        var file = e.target.files && e.target.files[0];
        if(!file){showToast('未选择文件','error');return}
        showToast('正在读取文件，请稍候...','info');

        var reader = new FileReader();
        // 注意：这里改成了 async function
        reader.onload = async function(evt){
            try{
                var wb = XLSX.read(new Uint8Array(evt.target.result),{type:'array'});

                var targetProjId = parseInt(currentProject, 10);
                var targetModId = parseInt(currentModule, 10);
                var activeProj = globalData.projects.find(function(p){ return p.id === targetProjId });
                var activeMod = (activeProj.modules||[]).find(function(m){ return m.id === targetModId });

                if(!activeProj || !activeMod) throw new Error("未找到对应模块");

                var newCasesToInsert = []; // 存放需要批量发送给后端的数据

                wb.SheetNames.forEach(function(sheetName){
                    var json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1, defval:''});
                    if(json.length<2) return;

                    var headerRowIdx = -1;
                    var map = {};
                    for(var r=0; r<Math.min(10, json.length); r++){
                        for(var c=0; c<json[r].length; c++){
                            var val = String(json[r][c]||'').replace(/\s+/g,'');
                            if(val === '测试点' || val === '用例名称' || val === '功能点'){
                                headerRowIdx = r; break;
                            }
                        }
                        if(headerRowIdx !== -1){
                            json[r].forEach(function(h, i){ if(h) map[String(h).replace(/\s+/g,'')] = i; });
                            break;
                        }
                    }

                    if(headerRowIdx === -1) return;

                    var tpCol = map['测试点']!==undefined ? map['测试点'] : (map['功能点']!==undefined ? map['功能点'] : map['用例名称']);
                    var lvCol = map['等级']!==undefined ? map['等级'] : (map['危险等级']!==undefined ? map['危险等级'] : map['优先级']);
                    var preCol = map['前置条件']!==undefined ? map['前置条件'] : (map['基础基岩']!==undefined ? map['基础基岩'] : map['前提条件']);
                    var stepCol = map['操作步骤']!==undefined ? map['操作步骤'] : (map['模拟推导']!==undefined ? map['模拟推导'] : map['步骤']);
                    var expCol = map['预期结果']!==undefined ? map['预期结果'] : (map['标定落点']!==undefined ? map['标定落点'] : map['预期']);
                    var remCol = map['备注']!==undefined ? map['备注'] : map['说明'];

                    if(tpCol === undefined) return;

                    for(var r=headerRowIdx+1; r<json.length; r++){
                        var row = json[r];
                        if(!row || !row.length) continue;
                        var point = row[tpCol];
                        if(!point || !String(point).trim()) continue;

                        newCasesToInsert.push({
                            projectId: activeProj.id, projectName: activeProj.name,
                            moduleId: activeMod.id, moduleName: activeMod.name,
                            point: String(point).trim(),
                            level: (lvCol!==undefined && row[lvCol]) ? String(row[lvCol]).trim() : 'P3',
                            precondition: (preCol!==undefined && row[preCol]) ? String(row[preCol]) : '',
                            steps: (stepCol!==undefined && row[stepCol]) ? String(row[stepCol]) : '',
                            expected: (expCol!==undefined && row[expCol]) ? String(row[expCol]) : '',
                            remark: (remCol!==undefined && row[remCol]) ? String(row[remCol]) : '',
                            creator: currentUser.username
                        });
                    }
                });

                // 【核心修改】：将解析出来的数据，批量 POST 给后端
                if(newCasesToInsert.length > 0){
                    const res = await authFetch('/api/testcase/batch_add', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(newCasesToInsert)
                    });
                    const resData = await res.json();

                    if(resData.success){
                        await fetchServerData(); // 重新拉取
                        document.getElementById('searchInput').value = '';
                        clearSelection();
                        renderTestCaseView(); renderTaskTable(); updateStats(); renderCharts();
                        showToast('导入成功！共写入 '+ resData.count +' 条记录。','success');
                    }
                } else {
                    showToast('未能导入任何有效数据，请检查文件格式','error');
                }
            }catch(err){console.error(err);showToast('导入失败，处理过程出错','error');}
        };
        reader.readAsArrayBuffer(file);
    };
    input.click();
}

function updateStats(){var data=getData(),cases=data.testcases||[];var pass=0,fail=0,pending=0;cases.forEach(function(tc){if(tc.status==='通过')pass++;else if(tc.status==='未通过')fail++;else pending++});document.getElementById('statTotal').textContent=cases.length;document.getElementById('statPass').textContent=pass;document.getElementById('statFail').textContent=fail;document.getElementById('statPending').textContent=pending}

function renderCharts(){
    var data=getData(),box=document.getElementById('chartContainer');
    if(!data.charts||!data.charts.length){
        data.charts=[{id:1,type:'pie',title:'用例状态分布'}];
        setData(data);
    }
    box.innerHTML=data.charts.map(function(ch){
        return '<div class="chart-box"><div class="chart-header"><span>'+esc(ch.title)+'</span><button class="btn btn-small btn-danger" onclick="removeChart('+ch.id+')">删除</button></div><div id="echart_'+ch.id+'" class="chart-placeholder" style="height:240px;width:100%;padding:0;background:transparent;"></div></div>'
    }).join('');

    setTimeout(function() {
        data.charts.forEach(function(ch) { initEChart(ch.id, ch.type); });
    }, 50);
}

// 优化：彻底修复饼图文字堆积叠放、重叠以及移除缺口
function initEChart(id, type) {
    var dom = document.getElementById('echart_' + id);
    if (!dom || typeof echarts === 'undefined') return;

    var myChart = echarts.getInstanceByDom(dom) || echarts.init(dom);
    var data = getData();
    var cases = data.testcases || [];
    var option = {};

    if (cases.length === 0) {
        myChart.clear();
        dom.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:var(--text-secondary);font-size:14px;">暂无用例数据</div>';
        return;
    }

    if (type === 'pie') {
        var pass=0, fail=0, pending=0;
        cases.forEach(function(tc){
            if(tc.status==='通过') pass++; else if(tc.status==='未通过') fail++; else pending++;
        });
        option = {
            tooltip: { trigger: 'item' },
            legend: { bottom: '0%', left: 'center' },
            color: ['#34c759', '#ff3b30', '#ff9500'],
            series: [{
                name: '用例状态', type: 'pie',
                radius: ['30%', '50%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                /* 优化：设置 borderWidth 为 0，移除边界和圆角缺口，呈现完全的环形 */
                itemStyle: { borderRadius: 0, borderColor: '#fff', borderWidth: 0 },
                /* 优化：引入 minAngle，确保比例极小的切片也有基础角度展开指示线，避免线条重叠和文字堆积 */
                minAngle: 10,
                label: {
                    show: true,
                    formatter: '{b}\n{c} ({d}%)',
                    fontSize: 12,
                    lineHeight: 16,
                    color: 'inherit',
                    fontWeight: 600
                },
                labelLine: {
                    show: true,
                    /* 优化：引入少量平滑效果并且缩短拉引线距离，使得视觉效果更为柔和不凌乱 */
                    smooth: 0.2,
                    length: 15,
                    length2: 25
                },
                data: [ { value: pass, name: '已通过' }, { value: fail, name: '未通过' }, { value: pending, name: '待测试' } ]
            }]
        };
    } else if (type === 'bar') {
        var map = {};
        cases.forEach(function(tc){ map[tc.moduleName || '未知模块'] = (map[tc.moduleName || '未知模块']||0)+1; });
        var keys = Object.keys(map).slice(0, 10);
        var values = keys.map(function(k){ return map[k]; });
        option = {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '10%', containLabel: true },
            xAxis: { type: 'category', data: keys, axisLabel: { interval: 0, rotate: 30 } }, yAxis: { type: 'value' },
            series: [{ data: values, type: 'bar', barMaxWidth: 40, itemStyle: { color: '#007aff', borderRadius: [6,6,0,0] } }]
        };
    } else if (type === 'line') {
        // 1. 获取过去 6 天的日期标签 (显示在 X 轴)
        var recentDays = [];
        var fullDates = [];
        for(var i=5; i>=0; i--){
            var d = new Date();
            d.setDate(d.getDate() - i);
            var month = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            recentDays.push(month + '-' + day);
            fullDates.push(d.getFullYear() + '-' + month + '-' + day);
        }

        // 2. 统计每天的新增用例数量
        var dateMap = {};
        cases.forEach(function(tc){
            var dateStr = tc.createTime || fullDates[5]; // 兼容旧数据，没时间的算作今天
            dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
        });

        // 3. 计算累计趋势曲线
        var trendData = [];
        var cumulative = 0;

        // 找出6天以前的历史基数
        cases.forEach(function(tc){
            if(tc.createTime && tc.createTime < fullDates[0]) cumulative++;
        });

        fullDates.forEach(function(day){
            cumulative += (dateMap[day] || 0); // 每天的基数 = 昨天累计 + 今天新增
            trendData.push(cumulative);
        });

        option = {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '5%', top: '10%', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: recentDays },
            yAxis: { type: 'value' },
            series: [{
                name: '总用例数', type: 'line', smooth: true,
                data: trendData,
                areaStyle: { opacity: 0.15 }, itemStyle: { color: '#0a84ff' }, lineStyle: { width: 3 }
            }]
        };
    }

    myChart.setOption(option);
    window.addEventListener('resize', function() { myChart.resize(); });
}

function addChart(){document.getElementById('chartType').value='pie';document.getElementById('chartTitle').value='';document.getElementById('chartModal').classList.add('show')}
function confirmAddChart(){var data=getData();if(!data.charts)data.charts=[];data.charts.push({id:getNextId(data.charts),type:document.getElementById('chartType').value,title:document.getElementById('chartTitle').value.trim()||'新图表'});setData(data);closeModal('chartModal');renderCharts();showToast('图表添加成功','success')}
function removeChart(id){var data=getData();data.charts=(data.charts||[]).filter(function(x){return x.id!==id});setData(data);renderCharts();showToast('图表已删除','success')}

// 判断是否有权限删除目标用户
function canDeleteMember(targetRole, targetId) {
    if (currentUser.role === 'superadmin') return targetId !== currentUser.id;
    if (currentUser.role === 'admin') return targetRole === 'tester';
    return false; // tester 无法删除任何人
}

function renderTeamTable(){
    var data=getData();
    var html='';
    data.users.forEach(function(u){
        var avatar=getUserAvatarHTML(u);
        var delBtn = canDeleteMember(u.role, u.id) ? '<button class="btn btn-small btn-danger" onclick="deleteTeamMember('+u.id+')">删除</button>' : '';
        html+='<tr><td>'+u.id+'</td><td><div class="team-avatar">'+avatar+'</div></td><td style="font-weight:600;">'+esc(u.chineseName||'-')+'</td><td>'+esc(u.username)+'</td><td>'+esc(u.email)+'</td><td>'+esc(u.phone||'-')+'</td><td><span class="badge badge-role-'+u.role+'">'+getRoleName(u.role)+'</span></td><td><button class="btn btn-small btn-primary" onclick="editTeamMember('+u.id+')">编辑</button> ' + delBtn + '</td></tr>';
    });
    document.getElementById('teamTableBody').innerHTML=html;
}

// 动态限制弹窗内的角色选择
function setupRoleOptions(targetUser) {
    var roleSelect = document.getElementById('memberRole');
    roleSelect.innerHTML = '';
    roleSelect.disabled = false;

    if (!targetUser) { // 场景：新增成员
        if (currentUser.role === 'superadmin') {
            roleSelect.innerHTML = '<option value="tester">测试工程师</option><option value="admin">管理员</option>';
        } else if (currentUser.role === 'admin') {
            roleSelect.innerHTML = '<option value="tester">测试工程师</option>';
        }
    } else { // 场景：编辑已有成员
        if (currentUser.role === 'superadmin') {
            if (targetUser.role === 'superadmin') {
                roleSelect.innerHTML = '<option value="superadmin">超级管理员</option>';
                roleSelect.disabled = true;
            } else {
                roleSelect.innerHTML = '<option value="tester">测试工程师</option><option value="admin">管理员</option>';
                roleSelect.value = targetUser.role;
            }
        } else if (currentUser.role === 'admin') {
            if (targetUser.role === 'admin') {
                roleSelect.innerHTML = '<option value="admin">管理员</option>';
                roleSelect.disabled = true;
            } else if (targetUser.role === 'tester') {
                roleSelect.innerHTML = '<option value="tester">测试工程师</option>';
                roleSelect.value = targetUser.role;
            } else {
                // 安全兜底
                roleSelect.innerHTML = '<option value="' + targetUser.role + '">' + getRoleName(targetUser.role) + '</option>';
                roleSelect.disabled = true;
            }
        }
    }
}

function openTeamMemberModal(){
    document.getElementById('teamModalTitle').textContent='添加成员';
    document.getElementById('editMemberId').value='';
    document.getElementById('memberChineseName').value='';
    document.getElementById('memberUsername').value='';
    document.getElementById('memberEmail').value='';
    document.getElementById('memberPhone').value='';
    setupRoleOptions(null);
    document.getElementById('memberPassword').value='';
    document.getElementById('teamMemberModal').classList.add('show');
}

function editTeamMember(id){
    var data=getData();
    var u=data.users.find(function(x){return x.id===id});
    if(!u)return;
    document.getElementById('teamModalTitle').textContent='编辑成员';
    document.getElementById('editMemberId').value=u.id;
    document.getElementById('memberChineseName').value=u.chineseName||'';
    document.getElementById('memberUsername').value=u.username;
    document.getElementById('memberEmail').value=u.email;
    document.getElementById('memberPhone').value=u.phone||'';

    setupRoleOptions(u);

    document.getElementById('memberPassword').value='';
    document.getElementById('teamMemberModal').classList.add('show');
}

// 4. 保存/新增团队成员
async function saveTeamMember(){
    var id=document.getElementById('editMemberId').value,
        cn=document.getElementById('memberChineseName').value.trim(),
        username=document.getElementById('memberUsername').value.trim(),
        email=document.getElementById('memberEmail').value.trim(),
        phone=document.getElementById('memberPhone').value.trim(),
        role=document.getElementById('memberRole').value,
        password=document.getElementById('memberPassword').value;

    if(!cn||!username||!email){showToast('请填写必填项','error');return}

    try {
        const res = await authFetch('/api/user', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: id || null, chineseName: cn, username: username,
                email: email, phone: phone, role: role, password: password
            })
        });
        const result = await res.json();
        if(result.success){
            closeModal('teamMemberModal');
            await fetchServerData();
            renderTeamTable();
            showToast('成员保存成功','success');
        } else {
            showToast(result.message, 'error'); // 如果重名会提示
        }
    } catch(e) { showToast('保存异常', 'error'); }
}

// 5. 删除团队成员
async function deleteTeamMember(id){
    if(!confirm('确定永久删除该成员？'))return;
    try {
        const res = await authFetch('/api/user/' + id, { method: 'DELETE' });
        const result = await res.json();
        if(result.success){
            await fetchServerData();
            renderTeamTable();
            showToast('成员已删除','success');
        }
    } catch(e) { showToast('删除异常', 'error'); }
}

function renderPermissions(){
    var data=getData();
    var allPerms=[
        ['dashboard','首页访问'],['casegen','用例生成'],['testcases','用例仓库访问'],['tasks','任务中心'],['team','团队管理'],['permission','权限管理'],['settings','系统设置'],
        ['add_case','新增用例'],['edit_case','编辑用例'],['delete_case','删除用例'],['batch_delete_case','批量删除用例'],['update_status','状态更新'],['assign_case','分配用例'],
        ['add_user','添加用户'],['edit_user','编辑用户'],['delete_user','删除用户'],['add_chart','添加图表'],['add_project','添加项目'],['add_module','添加模块']
    ];
    var roles=[['superadmin','超级管理员'],['admin','管理员'],['tester','测试工程师']];
    var html='';
    roles.forEach(function(role){
        var curr=data.permissions[role[0]]||[];
        html+='<div class="permission-group"><h4 style="margin-bottom:14px; font-weight:700;">'+role[1]+'</h4><div class="permission-list">';
        allPerms.forEach(function(p){
            html+='<div class="permission-item"><input type="checkbox" id="perm_'+role[0]+'_'+p[0]+'" data-role="'+role[0]+'" data-perm="'+p[0]+'" '+(curr.indexOf(p[0])!==-1?'checked':'')+'><label for="perm_'+role[0]+'_'+p[0]+'" style="cursor:pointer">'+p[1]+'</label></div>'
        });
        html+='</div></div>'
    });
    document.getElementById('permissionContainer').innerHTML=html;
}
function savePermissions(){var data=getData();data.permissions={superadmin:[],admin:[],tester:[]};document.querySelectorAll('#permissionContainer input[type="checkbox"]').forEach(function(cb){if(cb.checked)data.permissions[cb.dataset.role].push(cb.dataset.perm)});setData(data);applyPermissions();renderSidebar();showToast('权限保存成功','success')}

function switchSettingsTab(tab,el){document.querySelectorAll('.settings-tab').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.settings-panel').forEach(function(x){x.classList.remove('active')});if(el)el.classList.add('active');document.getElementById('settings-'+tab).classList.add('active')}
function loadSettings(){var data=getData(),basic=data.settings&&data.settings.basic||{},ai=data.settings&&data.settings.ai||{};document.getElementById('sysName').value=basic.sysName||'QA TestHub Ultimate';document.getElementById('sysPageSize').value=basic.sysPageSize||'15';document.getElementById('sysEmailNotify').checked=basic.sysEmailNotify!==false;document.getElementById('sysAutoSave').checked=basic.sysAutoSave!==false;document.getElementById('aiEnabled').checked=!!ai.aiEnabled;document.getElementById('aiApiKey').value=ai.aiApiKey||'';document.getElementById('aiApiUrl').value=ai.aiApiUrl||'';}
function saveBasicSettings(){var data=getData();if(!data.settings)data.settings={};data.settings.basic={sysName:document.getElementById('sysName').value,sysPageSize:document.getElementById('sysPageSize').value,sysEmailNotify:document.getElementById('sysEmailNotify').checked,sysAutoSave:document.getElementById('sysAutoSave').checked};pageSize=parseInt(data.settings.basic.sysPageSize,10);document.getElementById('pageSize').value=data.settings.basic.sysPageSize;setData(data);showToast('基本设置保存成功','success')}
function saveAISettings(){var data=getData();if(!data.settings)data.settings={};data.settings.ai={aiEnabled:document.getElementById('aiEnabled').checked,aiApiKey:document.getElementById('aiApiKey').value,aiApiUrl:document.getElementById('aiApiUrl').value};setData(data);showToast('API设置保存成功','success')}

function openProfile(){
    if(!currentUser)return;
    selectedAvatar=currentUser.avatar||'male';
    document.querySelectorAll('.avatar-option').forEach(function(x){
        x.classList.remove('selected');
        if(x.dataset.type===selectedAvatar) x.classList.add('selected');
    });
    if(currentUser.avatar==='custom'&&currentUser.avatarData){
        document.getElementById('customAvatarIcon').innerHTML='<img src="'+currentUser.avatarData+'">';
        document.getElementById('customAvatarOption').dataset.avatarData=currentUser.avatarData;
    } else {
        document.getElementById('customAvatarIcon').innerHTML='<span style="font-size: 16px; font-weight: bold; color: var(--primary); margin-bottom: 2px;">+</span><span style="font-size: 20px;">📷</span>';
    }
    document.getElementById('editChineseName').value=currentUser.chineseName||'';
    document.getElementById('editUsername').value=currentUser.username;
    document.getElementById('editPhone').value=currentUser.phone||'';
    document.getElementById('editEmail').value=currentUser.email||'';
    document.getElementById('profileModal').classList.add('show');
}

function selectAvatar(el,type){
    selectedAvatar=type;
    document.querySelectorAll('.avatar-option').forEach(function(x){x.classList.remove('selected')});
    el.classList.add('selected');
}

function handleAvatarUpload(event){
    var file=event.target.files&&event.target.files[0];
    if(!file)return;
    var reader=new FileReader();
    reader.onload=function(e){
        document.getElementById('avatarCropModal').classList.add('show');
        showAvatarEditor(e.target.result);
        selectAvatar(document.getElementById('customAvatarOption'), 'custom');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function confirmAvatarCrop() {
    var cvs=document.getElementById('avatarPreviewCanvas');
    if(cvs && avatarEditState.rawData){
        var avatarData = cvs.toDataURL('image/png');
        selectedAvatar='custom';
        document.querySelectorAll('.avatar-option').forEach(function(x){x.classList.remove('selected')});
        document.getElementById('customAvatarOption').classList.add('selected');
        document.getElementById('customAvatarIcon').innerHTML='<img src="'+avatarData+'">';
        document.getElementById('customAvatarOption').dataset.avatarData=avatarData;
    }
    closeModal('avatarCropModal');
}

// 【真实接口版】保存个人资料与自定义头像
async function saveProfile(){
    var cn=document.getElementById('editChineseName').value.trim();
    if(!/^[\u4e00-\u9fa5]{2,10}$/.test(cn)){ showToast('中文名格式错误：仅限2-10位纯中文字符', 'error'); return; }

    // 构建发给后端的数据
    var payload = {
        id: currentUser.id,
        chineseName: cn,
        phone: document.getElementById('editPhone').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        avatar: selectedAvatar
    };

    // 如果选择了自定义头像，就把 Base64 编码一起传过去
    if(selectedAvatar === 'custom'){
        payload.avatarData = document.getElementById('customAvatarOption').dataset.avatarData || currentUser.avatarData;
    } else {
        payload.avatarData = null;
    }

    try {
        const res = await authFetch('/api/user/profile', {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if(result.success){
            currentUser = result.user; // 更新前端内存
            closeModal('profileModal');
            updateAvatar(); // 刷新右上角头像
            await fetchServerData();
            renderTeamTable(); // 刷新团队列表里的头像
            showToast('个人资料保存成功','success');
        }
    } catch(e) { showToast('保存异常', 'error'); }
}

function openPassword(){document.getElementById('oldPassword').value='';document.getElementById('newPassword').value='';document.getElementById('confirmPassword').value='';document.getElementById('passwordModal').classList.add('show')}
// 7. 修改密码
async function savePassword(){
    var oldP=document.getElementById('oldPassword').value,
        newP=document.getElementById('newPassword').value,
        confirmP=document.getElementById('confirmPassword').value;

    if(!newP||newP.length<6){showToast('新密码长度不能少于6位','error');return}
    if(newP!==confirmP){showToast('两次输入的密码不一致','error');return}

    try {
        const res = await authFetch('/api/user/password', {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: currentUser.id, oldPassword: oldP, newPassword: newP
            })
        });
        const result = await res.json();
        if(result.success){
            closeModal('passwordModal');
            showToast('密码修改成功，请用新密码重新登录','success');
            // 修改密码后强制退出登录
            setTimeout(() => handleLogout(), 1500);
        } else {
            showToast(result.message, 'error'); // 比如：当前密码验证失败
        }
    } catch(e) { showToast('修改异常', 'error'); }
}

function populateGeneratorProjectSelect(){}

function handleGeneratorFile(event){
    var file=event.target.files&&event.target.files[0];
    if(!file)return;
    var ext = file.name.split('.').pop().toLowerCase();
    if(ext === 'docx') {
        var reader = new FileReader();
        reader.onload = function(e) {
            if(typeof mammoth !== 'undefined') {
                mammoth.extractRawText({arrayBuffer: e.target.result})
                .then(function(result){ document.getElementById('genPrompt').value = result.value; showToast('Word文档已成功解析','success'); })
                .catch(function(err){ showToast('文档解析失败: ' + err.message, 'error'); });
            } else { showToast('解析依赖缺失，请刷新页面', 'error'); }
        };
        reader.readAsArrayBuffer(file);
    } else {
        var reader=new FileReader();
        reader.onload=function(e){ document.getElementById('genPrompt').value=e.target.result; showToast('文档内容提取成功','success') };
        reader.readAsText(file,'utf-8');
    }
    event.target.value = '';
}

function normalizeGeneratorLines(text){return text.split(/\r?\n/).map(function(x){return x.trim()}).filter(function(x){return x})}
function inferCaseFromLine(line,index){var pure=line.replace(/^[-*•\d.、\s]+/,'').trim();return {point:pure||('自动生成用例'+(index+1)),level:index<1?'P0':index<4?'P1':'P2',precondition:'保证系统前置环境正常',steps:'1. 进入对应功能页面\n2. 依据“'+pure+'”执行操作\n3. 观察执行结果',expected:'系统能正确响应“'+pure+'”，无异常报错',remark:'AI/规则抽取'} }

function generateCasesFromInput(){
    var text=document.getElementById('genPrompt').value.trim();
    var repo=document.getElementById('genRepo').value;
    var projectName=document.getElementById('genProject').value.trim();
    var moduleName=document.getElementById('genModule').value.trim();

    if(!projectName||!moduleName){showToast('请填写目标项目与模块','error');return}
    if(!text){showToast('请先上传文档','error');return}

    var lines=normalizeGeneratorLines(text);
    if(!lines.length){showToast('未提取到有效操作点','error');return}

    var tempProjId = 'temp_p_' + Date.now();
    var tempModId = 'temp_m_' + Date.now();

    generatedCases=lines.slice(0,100).map(function(line,idx){
        var base=inferCaseFromLine(line,idx);
        return {
            id:'gen_'+Date.now()+'_'+idx,
            repo: repo,
            projectId: tempProjId, projectName: projectName,
            moduleId: tempModId, moduleName: moduleName,
            point:base.point, level:base.level, precondition:base.precondition,
            steps:base.steps, expected:base.expected, remark:base.remark,
            status:'待测试', creator:currentUser.username, executor:'', assignedBy:''
        };
    });
    renderGeneratedPreview();
    showToast('智能解析成功，共 '+generatedCases.length+' 条用例','success');
}

// 【修改后的预览表格渲染函数】
function renderGeneratedPreview() {
    var box = document.getElementById('generatedPreview');
    // 1. 如果没有数据时的显示
    if (!generatedCases.length) {
        box.className = 'empty-state generator-preview';
        box.innerHTML = '暂无生成结果，请先上传文档并执行生成';
        return;
    }

    // 2. 有数据时，应用系统的表格容器样式 (table-container)
    box.className = 'generator-preview table-container';

    // 3. 拼接完整的 HTML 表格结构
    var html = '<table class="data-table">';

    // -- 表头部分 (Thead) --
    html += '<thead><tr>';
    html += '<th style="width: 50px;">序号</th>';
    html += '<th>模块</th>';
    html += '<th>测试点</th>';
    html += '<th>等级</th>';
    html += '<th>前置条件</th>';
    html += '<th>操作步骤</th>';
    html += '<th>预期结果</th>';
    html += '<th style="width: 150px;">备注</th>';
    html += '</tr></thead>';

    // -- 表体部分 (Tbody) --
    html += '<tbody>';
    html += generatedCases.map(function(tc, idx) {
        // 判断等级来赋予不同颜色的徽章
        var levelClass = tc.level === 'P0' ? 'badge-p0' : (tc.level === 'P1' ? 'badge-p1' : (tc.level === 'P2' ? 'badge-p2' : 'badge-p3'));
        var row = '<tr>';
        // 拼接每一列的数据
        row += '<td>' + (idx + 1) + '</td>';
        row += '<td>' + esc(tc.projectName) + ' / ' + esc(tc.moduleName) + '</td>';
        row += '<td>' + esc(tc.point) + '</td>';
        row += '<td><span class="badge ' + levelClass + '">' + tc.level + '</span></td>';
        row += '<td style="white-space:pre-wrap; font-size:13px; color:var(--text-secondary);">' + esc(tc.precondition) + '</td>';
        row += '<td style="white-space:pre-wrap; font-size:13px; line-height:1.5;">' + esc(tc.steps) + '</td>';
        row += '<td style="white-space:pre-wrap; font-size:13px; line-height:1.5;">' + esc(tc.expected) + '</td>';
        row += '<td style="font-size:13px;">' + esc(tc.remark) + '</td>';
        row += '</tr>';
        return row;
    }).join('');

    html += '</tbody></table>';

    // 将生成的表格注入到页面中
    box.innerHTML = html;
}

// 【修改后的用例保存逻辑】
async function saveGeneratedCases(){
    // 需求点 1：如果没有用例就直接提示
    if(!generatedCases.length){
        showToast('没有可保存的用例','error');
        return;
    }

    // 获取页面填写的项目和模块名称
    var projectName = document.getElementById('genProject').value.trim();
    var moduleName = document.getElementById('genModule').value.trim();

    // 【新增】：检查项目名和模块名是否填写
    if(!projectName || !moduleName){
        showToast('请填写所属项目和模块', 'error');
        return;
    }

    // 需求点 2：直接强制走“待审核” (pending) 逻辑
    var cat = 'pending';

    // 查找当前的审核项目列表，看是否存在该项目
    var projects = getReviewProjects().filter(function(p) { return (p.category || 'pending') === cat; });
    var proj = projects.find(function(p) { return p.name === projectName; });

    // 如果没有，就自动新建一个待审核项目
    if (!proj) {
        var newProjId = addReviewProject(projectName, cat);
        proj = { id: newProjId, name: projectName, category: cat };
    }

    // 查找该项目下是否存在该模块
    var modules = getReviewModules().filter(function(m) { return String(m.projectId) === String(proj.id); });
    var mod = modules.find(function(m) { return m.name === moduleName; });

    // 如果没有，就自动新建一个待审核模块
    if (!mod) {
        var newModId = addReviewModule(proj.id, moduleName, cat);
        mod = { id: newModId, projectId: proj.id, name: moduleName, category: cat };
    }

    // 将刚才生成的测试用例，全部打上项目和模块标签，存入审核区
    var reviewTcs = getReviewTestcases();
    generatedCases.forEach(function(tc) {
        reviewTcs.push({
            id: 'rv_tc_' + Date.now() + '_' + Math.random().toString(36).substr(2,6),
            projectId: proj.id,
            projectName: proj.name,
            moduleId: mod.id,
            moduleName: mod.name,
            point: tc.point,
            level: tc.level,
            precondition: tc.precondition,
            steps: tc.steps,
            expected: tc.expected,
            remark: tc.remark,
            creator: tc.creator,
            status: '未执行'
        });
    });

    // 保存到本地存储
    saveReviewTestcases(reviewTcs);

    // 清空生成区，重置状态
    generatedCases = [];
    document.getElementById('genPrompt').value = '';
    renderGeneratedPreview();
    renderReviewTable(); // 顺便刷新一下审核表格
    renderSidebar();     // 刷新左侧边栏

    // 提示用户保存成功
    showToast('生成用例已成功保存至待审核','success');
}

function clearGeneratedCases(){generatedCases=[];document.getElementById('genPrompt').value='';renderGeneratedPreview()}

window.onclick=function(e){
    if(!e.target.closest('.user-menu'))document.getElementById('userDropdown').classList.remove('show');
    if(!e.target.closest('.column-setting'))document.getElementById('columnDropdown').classList.remove('show');
}

// ----------------------------------------------------
// 核心状态还原引擎：基于 JWT 强校验的恢复机制
// ----------------------------------------------------
async function autoRestore() {
    try {
        // 第一关：检查本地有没有 Token
        var token = localStorage.getItem('qa_token');
        loadRememberedAccount(); // 自动填充记住的账号密码
        if(!token){
            document.getElementById('loginPage').style.display='flex';
            return;
        }

        // 第二关：拿着 Token 去后端验真伪
        const authRes = await authFetch('/api/user/me');
        const authData = await authRes.json();

        if(authData.success) {
            currentUser = authData.user;

            // 第三关：拉取最新的全局业务数据
            await fetchServerData();

            document.getElementById('loginPage').style.display='none';
            document.getElementById('mainApp').style.display='block';

            loadUISettings();
            updateAvatar();
            initColumnDropdown();

            currentProject = localStorage.getItem('qa_currentProject') || '';
            currentModule = localStorage.getItem('qa_currentModule') || '';
            currentTaskFilter = localStorage.getItem('qa_currentTaskFilter') || 'myCharge';
            currentReviewFilter = localStorage.getItem('qa_currentReviewFilter') || '';
            currentReviewProjectId = localStorage.getItem('qa_rv_projectId') || '';
            currentReviewModuleId = localStorage.getItem('qa_rv_moduleId') || '';

            // 【本次新增】：从本地缓存中读取任务中心的项目和模块
            currentTaskProject = localStorage.getItem('qa_currentTaskProject') || '';
            currentTaskModule = localStorage.getItem('qa_currentTaskModule') || '';

            currentPage = parseInt(localStorage.getItem('qa_currentPage') || '1', 10);
            var lastTab = localStorage.getItem('qa_currentTab') || 'dashboard';

            applyPermissions();
            loadSettings();
            populateGeneratorProjectSelect();

            // 【本次新增】：智能展开机制！
            // 刷新后，不仅要恢复选中状态，还要强制把侧边栏对应的父级菜单展开，确保你一眼就能“看到”自己选了什么！
            if (lastTab === 'testcases' && currentProject) {
                expandedMenu['testcases'] = true;
                expandedMenu['proj_' + currentProject] = true;
            } else if (lastTab === 'tasks') {
                expandedMenu['tasks'] = true;
                expandedMenu['task_sub_' + currentTaskFilter] = true;
                if (currentTaskProject) {
                    expandedMenu['task_proj_' + currentTaskFilter + '_' + currentTaskProject] = true;
                }
            } else if (lastTab === 'review') {
                expandedMenu['review'] = true;
                if (currentReviewFilter) {
                    expandedMenu['rv_sub_' + currentReviewFilter] = true;
                }
            }
            // 将智能展开的结果保存，避免闪烁
            localStorage.setItem('qa_expandedMenu', JSON.stringify(expandedMenu));

            currentTab = lastTab;
            closeAllPages();
            var pEl = document.getElementById('page-'+lastTab);
            if(pEl) pEl.classList.add('active');

            var titles={dashboard:'首页',casegen:'用例生成',review:'用例审核 - '+({'pending':'待审核','rejected':'未通过'}[currentReviewFilter]||'待审核'),tasks:'任务中心',team:'团队管理',permission:'权限配置',settings:'系统设置'};
            if (lastTab !== 'testcases') { document.getElementById('pageTitle').textContent = titles[lastTab]||'首页'; }

            renderSidebar();

            // 根据恢复出的状态，执行对应的页面渲染
            if(lastTab==='dashboard'){updateStats();renderCharts();}
            else if(lastTab==='casegen'){populateGeneratorProjectSelect();renderGeneratedPreview();}
            else if(lastTab==='review'){renderReviewView();}
            else if(lastTab==='testcases'){renderTestCaseView();}
            else if(lastTab==='tasks'){renderTaskTable();}
            else if(lastTab==='team'){renderTeamTable();}
            else if(lastTab==='permission'){renderPermissions();}
            else if(lastTab==='settings'){loadSettings();}

        } else {
            // Token 过期或伪造，清空假数据，打回原形
            document.getElementById('loginPage').style.display='flex';
            localStorage.removeItem('qa_token');
        }
    } catch(e) {
        console.error("环境数据恢复失败:", e);
        document.getElementById('loginPage').style.display='flex';
        localStorage.removeItem('qa_token');
    }
}

// ================= 表格列宽拖拽调整 (带列宽记忆版) =================
var _resizeInitLock = false;
function initColumnResize() {
    if (_resizeInitLock) return;
    _resizeInitLock = true;
    document.querySelectorAll('.data-table').forEach(function(table) {
        var ths = Array.from(table.querySelectorAll('thead th'));

        // 【新增 1】：获取该表格独一无二的标识 ID（区分是用例仓库、审核、还是任务中心）
        // 这样就可以做到不同页签的列宽互不干扰
        var tableId = table.id || (table.querySelector('tbody') ? table.querySelector('tbody').id : 'common_table');

        // 【新增 2】：读取本地保存的列宽数据，如果没有则给个空对象
        var data = getData();
        if (!data.ui) data.ui = {};
        if (!data.ui.colWidths) data.ui.colWidths = {};
        var savedWidths = data.ui.colWidths[tableId] || {};

        var isFresh = true;
        // 检查是不是刚渲染的新表格（通过有没有插入过拖拽手柄来判断）
        ths.forEach(function(th) { if (th.querySelector('.col-resize-handle')) isFresh = false; });

        // 【核心优化】：只有在表格全新渲染时，才执行历史宽度恢复，防止在拖拽时互相冲突打架
        if (isFresh) {
            // 恢复整个表格的总宽度（防止以前撑大的表格刷新后缩水）
            if (savedWidths['_table_width_']) {
                table.style.width = savedWidths['_table_width_'];
                table.style.minWidth = savedWidths['_table_minWidth_'];
                table.style.maxWidth = 'none';
            } else {
                table.style.width = '100%';
                table.style.minWidth = '100%';
                table.style.maxWidth = 'none';
            }

            // 循环恢复每个单独列的宽度
            ths.forEach(function(th, index) {
                // 提取表头文字作为唯一标识（如果是最左边的多选框则标记为 checkbox）
                var colName = th.textContent.trim() || (th.classList.contains('checkbox-col') ? 'checkbox' : 'col_' + index);

                if (savedWidths[colName]) {
                    th.style.width = savedWidths[colName];
                    th.style.minWidth = savedWidths[colName];
                    th.style.maxWidth = savedWidths[colName];
                }
            });
        }

        // 下面是手柄插入及拖拽逻辑
        ths.forEach(function(th, index) {
            if (th.querySelector('.col-resize-handle')) return;
            if (index === ths.length - 1) return; // 最后一列不加手柄

            var handle = document.createElement('div');
            handle.className = 'col-resize-handle';
            th.appendChild(handle);

            handle.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();

                var startX = e.pageX;

                // 瞬间锁死所有列当前的实际渲染像素
                ths.forEach(function(col) {
                    var w = col.getBoundingClientRect().width;
                    col.style.width = w + 'px';
                    col.style.minWidth = w + 'px';
                    col.style.maxWidth = w + 'px';
                });

                var startTableWidth = table.getBoundingClientRect().width;
                var containerWidth = table.parentElement.clientWidth;

                var isMaximized = startTableWidth <= containerWidth + 5;

                if (isMaximized) {
                    table.style.width = startTableWidth + 'px';
                    table.style.minWidth = startTableWidth + 'px';
                    table.style.maxWidth = startTableWidth + 'px';
                } else {
                    table.style.width = startTableWidth + 'px';
                    table.style.minWidth = startTableWidth + 'px';
                    table.style.maxWidth = 'none';
                }

                var nextTh = null;
                for (var j = index + 1; j < ths.length - 1; j++) {
                    if (ths[j].style.display !== 'none') {
                        nextTh = ths[j];
                        break;
                    }
                }
                if (!nextTh) {
                    for (var k = index - 1; k >= 0; k--) {
                        if (ths[k].style.display !== 'none' && !ths[k].classList.contains('checkbox-col')) {
                            nextTh = ths[k];
                            break;
                        }
                    }
                }

                var startColWidth = th.getBoundingClientRect().width;
                var startNextWidth = nextTh ? nextTh.getBoundingClientRect().width : 0;

                handle.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                var rafId = null;
                function onMouseMove(e2) {
                    if (rafId) return;
                    rafId = requestAnimationFrame(function() {
                        var diff = e2.pageX - startX;

                        if (isMaximized && nextTh) {
                            var minW = 40;
                            if (startColWidth + diff < minW) diff = minW - startColWidth;
                            if (startNextWidth - diff < minW) diff = startNextWidth - minW;

                            th.style.width = (startColWidth + diff) + 'px';
                            th.style.minWidth = (startColWidth + diff) + 'px';
                            th.style.maxWidth = (startColWidth + diff) + 'px';

                            nextTh.style.width = (startNextWidth - diff) + 'px';
                            nextTh.style.minWidth = (startNextWidth - diff) + 'px';
                            nextTh.style.maxWidth = (startNextWidth - diff) + 'px';
                        } else {
                            var newColWidth = Math.max(40, startColWidth + diff);
                            th.style.width = newColWidth + 'px';
                            th.style.minWidth = newColWidth + 'px';
                            th.style.maxWidth = newColWidth + 'px';

                            var actualDiff = newColWidth - startColWidth;
                            var newTableWidth = startTableWidth + actualDiff;
                            table.style.width = Math.max(newTableWidth, containerWidth) + 'px';
                            table.style.minWidth = Math.max(newTableWidth, containerWidth) + 'px';
                        }
                        rafId = null;
                    });
                }

                function onMouseUp() {
                    if (rafId) cancelAnimationFrame(rafId);
                    handle.classList.remove('dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    // --- 【新增 3：拖拽结束，将最新的列宽及表格宽保存到本地缓存中】 ---
                    var curData = getData();
                    if (!curData.ui) curData.ui = {};
                    if (!curData.ui.colWidths) curData.ui.colWidths = {};
                    if (!curData.ui.colWidths[tableId]) curData.ui.colWidths[tableId] = {};

                    // 保存当前拉伸后的表格总宽度
                    curData.ui.colWidths[tableId]['_table_width_'] = table.style.width;
                    curData.ui.colWidths[tableId]['_table_minWidth_'] = table.style.minWidth;

                    // 循环保存当前表格所有列的最新宽度
                    ths.forEach(function(col, colIdx) {
                        var cName = col.textContent.trim() || (col.classList.contains('checkbox-col') ? 'checkbox' : 'col_' + colIdx);
                        curData.ui.colWidths[tableId][cName] = col.style.width;
                    });

                    // 使用你原本系统的 setData 将数据安全存入 LocalStorage
                    setData(curData);
                    // -------------------------------------------------------------
                }
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    });
    _resizeInitLock = false;
}

// 监听表格变化，自动绑定拖拽手柄（防抖+监听 childList + subtree）
var _resizeTimer = null;
var _resizeObserver = new MutationObserver(function() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(initColumnResize, 100);
});
document.querySelectorAll('.table-container').forEach(function(tc) {
    _resizeObserver.observe(tc, { childList: true, subtree: true });
});
// 页面加载后初始化
setTimeout(initColumnResize, 200);

// 【本次新增】：任务中心专属——移除关联关系函数
async function removeTaskItem(type, filter, projId, modId) {
    var tip = type === 'project' ? '项目' : '模块';
    if(!confirm('确定要从当前页签中“移除”该'+tip+'吗？\n注意：这仅会移除你在该'+tip+'下的任务关系，不会删除系统中的项目和用例。')) return;

    var data = getData();
    // 找出当前视图下，该项目/模块里所有符合过滤条件的用例ID
    var targetIds = data.testcases.filter(function(tc) {
        if (String(tc.projectId) !== String(projId)) return false;
        if (modId && String(tc.moduleId) !== String(modId)) return false;

        // 匹配当前页签的筛选逻辑
        if(filter === 'myCharge' && tc.executor === currentUser.username) return true;
        if(filter === 'myCreate' && tc.creator === currentUser.username) return true;
        if(filter === 'myAssign' && tc.assignedBy === currentUser.username) return true;
        if(filter === 'completed' && (tc.status === '通过' || tc.status === '未通过')) return true;
        return false;
    }).map(function(tc){ return tc.id; });

    if(targetIds.length === 0) return;

    // 根据不同页签，决定清除哪个字段
    var updates = {};
    if(filter === 'myCharge') updates = { executor: '' };
    else if(filter === 'myAssign') updates = { assigned_by: '' };
    else if(filter === 'completed') updates = { status: '待测试' };
    else if(filter === 'myCreate') updates = { creator: '系统归档' };

    const res = await authFetch('/api/testcase/batch_update', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids: targetIds, updates: updates })
    });
    const result = await res.json();
    if(result.success) {
        // 【体验优化】：如果删除的正好是右侧当前正在看的模块或项目，就自动退回到上一级
        if(type === 'module' && currentTaskModule === String(modId)) currentTaskModule = '';
        if(type === 'project' && currentTaskProject === String(projId)) { currentTaskProject = ''; currentTaskModule = ''; }

        await fetchServerData(); // 重新拉取数据
        renderSidebar();         // 【核心修复1】：立刻刷新左侧导航栏，让它瞬间消失！
        renderTaskTable();       // 刷新右侧视图
        showToast('删除成功', 'success');
    }
}

// ================= 消息推送与审批引擎 (高性能即时版) =================
async function fetchMessages() {
    if(!currentUser) return;
    try {
        const res = await authFetch('/api/message/list');
        const data = await res.json();
        if(data.success) {
            // --- 性能优化核心：指纹对比 ---
            var currentSnapshot = JSON.stringify(data.messages);
            if (currentSnapshot === lastMessagesSnapshot) {
                return; // 【拦截】：数据完全没变，直接退出，不进行任何 DOM 渲染操作，节省性能
            }
            lastMessagesSnapshot = currentSnapshot; // 记录新快照

            var isAdmin = currentUser.role === 'admin' || currentUser.role === 'superadmin';
            var pendingMsgs = data.messages.filter(function(m){ return m.status === 'pending'; });

            // --- 即时提醒核心：新消息侦测 ---
            // 从本地缓存读取上一次记录的待审核数量
            var lastPendingCount = parseInt(localStorage.getItem('qa_recorded_pending_count') || '0');

            // 如果我是管理员，且现在的待审核数量增加了
            if (isAdmin && pendingMsgs.length > lastPendingCount) {
                var latestMsg = pendingMsgs[0]; // 获取最新的一条申请
                var typeTitle = latestMsg.targetType.indexOf('project') !== -1 ? '项目' : '模块';

                // 调用你系统原有的右下角通知函数
                showBottomNotification(
                    '收到新的重命名申请',
                    '员工 ' + (latestMsg.senderCn || latestMsg.sender) + ' 申请修改' + typeTitle + '名称'
                );
            }

            // 更新本地缓存的数量记录
            localStorage.setItem('qa_recorded_pending_count', pendingMsgs.length);

            // 执行页面渲染
            renderMessageMenu(data.messages);
        }
    } catch(e) {
        console.log("消息轮询异常，已自动跳过此周期");
    }
}

// 打开消息弹窗
function openMessageModal() {
    document.getElementById('messageModal').classList.add('show');
}

// 渲染消息弹窗内容，包含 UI 格式优化与极强防崩保护（双列对比版）
function renderMessageMenu(msgs) {
    var badge = document.getElementById('msgBadge');
    var container = document.getElementById('messageModalContainer');

    // 防弹衣 1：如果 HTML 没写对，直接在控制台提示，不引发全局崩溃
    if (!container) {
        console.error("严重错误：HTML 中找不到 id 为 messageModalContainer 的容器！请检查 index.html！");
        return;
    }

    var isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');

    // 防弹衣 2：如果数据为空，优雅显示空状态
    if (!msgs || msgs.length === 0) {
        if(badge) badge.style.display = 'none';
        container.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无任何消息或审批</div>';
        return;
    }

    var pendingCount = msgs.filter(function(m){ return m.status === 'pending'; }).length;
    if (pendingCount > 0) {
        if(badge) {
            badge.style.display = 'block';
            badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
        }
    } else {
        if(badge) badge.style.display = 'none';
    }

    // 构建表格 HTML（新增修正前、修正后两列）
    var html = '<table class="data-table" style="width:100%; min-width:100%; table-layout:auto; font-size:13px; margin:0; border:none; box-shadow:none;">';
    html += '<thead><tr>';
    html += '<th style="padding:14px 20px; width:70px;">申请人</th>';
    html += '<th style="padding:14px 20px; width:140px;">事件与内容变更明细</th>';
    html += '<th style="padding:14px 20px;">修正前</th>';
    html += '<th style="padding:14px 20px;">修正后</th>';
    html += '<th style="padding:14px 20px; width:70px;">状态</th>';
    if (isAdmin) html += '<th style="padding:14px 20px; width:110px; text-align:right;">操作</th>';
    html += '</tr></thead><tbody>';

    msgs.forEach(function(m) {
        // 防弹衣 3：将每条消息的渲染隔离开，一条报错绝不影响整体表格展示
        try {
            var eventText = '';
            var beforeHtml = '-';
            var afterHtml = '-';
            var targetType = m.targetType || 'unknown';

            if (targetType === 'testcase') {
                // 用例修正逻辑
                // 把原测试点的名称移动到“事件明细”这一列展示，让出“修正前”的空间
                eventText = '<div style="font-weight:700;">申请修正用例</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">【用例】：' + esc(m.oldName || '未知测试点') + '</div>';

                var newContentArr = [];
                var beforeContentArr = []; // 【新增：用来存放修正前的对齐 UI 结构】

                if (m.correctionPayload) {
                    try {
                        var payload = JSON.parse(m.correctionPayload);
                        var dict = {'point':'测试点', 'level':'等级', 'precondition':'前置条件', 'steps':'操作步骤', 'expected':'预期结果', 'remark':'备注'};

                        // 【核心新增：去本地数据池里揪出这条用例原本没修改前的数据】
                        var data = getData();
                        var origTc = (data.testcases || []).find(function(x) { return String(x.id) === String(m.targetId); });

                        for (var key in payload) {
                            if (payload[key] && dict[key]) {
                                // 修正后列：灰底标签 + 蓝色高亮新内容
                                newContentArr.push('<div style="margin-bottom:6px; word-break: break-all;"><span class="badge badge-p3" style="margin-right:6px; font-weight:normal;">' + dict[key] + '</span><span style="color:var(--primary); font-size:13px; font-weight:600;">' + esc(payload[key]) + '</span></div>');

                                // 修正前列：提取旧数据，灰底标签 + 灰色带删除线的旧内容
                                var oldVal = origTc ? origTc[key] : '';
                                if (key === 'point' && m.oldName) oldVal = m.oldName; // 如果改的是测试点名称，优先使用后端记录的最准旧名字

                                beforeContentArr.push('<div style="margin-bottom:6px; word-break: break-all;"><span class="badge badge-p3" style="margin-right:6px; font-weight:normal;">' + dict[key] + '</span><span style="color:var(--text-secondary); font-size:13px; text-decoration:line-through;">' + esc(oldVal || '') + '</span></div>');
                            }
                        }
                    } catch(e) { console.log("解析载荷失败忽略"); }
                }

                // 将拼接好的数组分别填充给“修正前”和“修正后”两列
                beforeHtml = beforeContentArr.length > 0 ? beforeContentArr.join('') : '<span style="color:var(--text-secondary)">-</span>';
                afterHtml = newContentArr.length > 0 ? newContentArr.join('') : '<span style="color:var(--text-secondary)">无实质内容变更</span>';

            } else if (targetType.indexOf('project') !== -1 || targetType.indexOf('module') !== -1) {
                // 项目/模块改名逻辑
                var prefix = targetType.indexOf('review') !== -1 ? '审核区' : '用例仓库';
                var typeName = targetType.indexOf('project') !== -1 ? '项目' : '模块';
                eventText = '<div style="font-weight:700;">请求修改' + typeName + '名称</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">所属：' + prefix + '</div>';

                beforeHtml = '<span style="text-decoration:line-through; color:var(--text-secondary); font-size: 14px;">' + esc(m.oldName || '未知') + '</span>';
                afterHtml = '<span style="color:var(--primary); font-weight:700; font-size: 14px;">' + esc(m.newName || '') + '</span>';
            } else {
                eventText = '未知系统事件';
            }

            html += '<tr style="border-bottom: 1px solid var(--border);">';
            html += '<td style="padding:16px 20px; font-weight:600; color:var(--text-primary); vertical-align:top;">' + esc(m.senderCn || m.sender || '未知') + '</td>';
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:top;">' + eventText + '</td>';
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:top; background: color-mix(in srgb, var(--text-secondary) 5%, transparent);">' + beforeHtml + '</td>'; // 修正前加一点点灰底区分
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:top;">' + afterHtml + '</td>';

            if(m.status === 'pending') {
                html += '<td style="padding:16px 20px; vertical-align:top;"><span style="color:var(--warning); font-weight:700;">待审批</span></td>';
                if(isAdmin) {
                    html += '<td style="padding:16px 20px; text-align:right; vertical-align:top;"><div style="display:flex; gap:8px; justify-content:flex-end;">';
                    html += '<button class="btn btn-small btn-success" onclick="handleMessageRequest('+m.id+', \'approve\')">通过</button>';
                    html += '<button class="btn btn-small btn-danger" onclick="handleMessageRequest('+m.id+', \'reject\')">驳回</button>';
                    html += '</div></td>';
                }
            } else {
                var sColor = m.status === 'approved' ? 'var(--success)' : 'var(--danger)';
                var sText = m.status === 'approved' ? '已通过' : '已驳回';
                html += '<td style="padding:16px 20px; vertical-align:top;"><span style="color:'+sColor+'; font-weight:700;">'+sText+'</span></td>';
                if(isAdmin) html += '<td style="padding:16px 20px; text-align:right; color:var(--text-secondary); vertical-align:top;">-</td>';
            }
            html += '</tr>';
        } catch (e) {
            console.error("渲染单条消息出错, 已跳过该条:", m, e);
        }
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// 渲染消息弹窗内容，包含 UI 格式优化与极强防崩保护（双列对比版）
function renderMessageMenu(msgs) {
    var badge = document.getElementById('msgBadge');
    var container = document.getElementById('messageModalContainer');

    // 防弹衣 1：如果 HTML 没写对，直接在控制台提示，不引发全局崩溃
    if (!container) {
        console.error("严重错误：HTML 中找不到 id 为 messageModalContainer 的容器！请检查 index.html！");
        return;
    }

    var isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');

    // 防弹衣 2：如果数据为空，优雅显示空状态
    if (!msgs || msgs.length === 0) {
        if(badge) badge.style.display = 'none';
        container.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无任何消息或审批</div>';
        return;
    }

    var pendingCount = msgs.filter(function(m){ return m.status === 'pending'; }).length;
    if (pendingCount > 0) {
        if(badge) {
            badge.style.display = 'block';
            badge.textContent = pendingCount > 99 ? '99+' : pendingCount;
        }
    } else {
        if(badge) badge.style.display = 'none';
    }

    // 构建表格 HTML（严格定义 6 个列的表头）
    var html = '<table class="data-table" style="width:100%; min-width:100%; table-layout:auto; font-size:13px; margin:0; border:none; box-shadow:none;">';
    html += '<thead><tr>';
    html += '<th style="padding:14px 20px; width:70px;">申请人</th>';

    // 【核心修改点】：重新分配中间三列的宽度
    // 1. 将明细列从原本拥挤的 150px 拓宽到 220px
    html += '<th style="padding:14px 20px; width:220px;">事件与内容变更明细</th>';
    // 2. 给修正前分配固定的 260px，保证旧数据展示不局促
    html += '<th style="padding:14px 20px; width:260px;">修正前</th>';
    // 3. 修正后不写死宽度，让它像海绵一样自动填满整个弹窗剩下的所有空间
    html += '<th style="padding:14px 20px;">修正后</th>';

    html += '<th style="padding:14px 20px; width:70px;">状态</th>';
    if (isAdmin) html += '<th style="padding:14px 20px; width:110px; text-align:left;">操作</th>';
    html += '</tr></thead><tbody>';

    msgs.forEach(function(m) {
        // 防弹衣 3：将每条消息的渲染隔离开，一条报错绝不影响整体表格展示
        try {
            var eventText = '';
            var beforeHtml = '-';
            var afterHtml = '-';
            var targetType = m.targetType || 'unknown';

            if (targetType === 'testcase') {
                // 用例修正逻辑
                eventText = '<div style="font-weight:700;">申请修正用例</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">【用例】：' + esc(m.oldName || '未知测试点') + '</div>';

                var newContentArr = [];
                var beforeContentArr = [];

                if (m.correctionPayload) {
                    try {
                        var payload = JSON.parse(m.correctionPayload);
                        var dict = {'point':'测试点', 'level':'等级', 'precondition':'前置条件', 'steps':'操作步骤', 'expected':'预期结果', 'remark':'备注'};

                        var data = getData();
                        var origTc = (data.testcases || []).find(function(x) { return String(x.id) === String(m.targetId); });

                        for (var key in payload) {
                            if (payload[key] && dict[key]) {
                                newContentArr.push('<div style="margin-bottom:6px; word-break: break-all;"><span class="badge badge-p3" style="margin-right:6px; font-weight:normal;">' + dict[key] + '</span><span style="color:var(--primary); font-size:13px; font-weight:600;">' + esc(payload[key]) + '</span></div>');

                                var oldVal = origTc ? origTc[key] : '';
                                if (key === 'point' && m.oldName) oldVal = m.oldName;

                                beforeContentArr.push('<div style="margin-bottom:6px; word-break: break-all;"><span class="badge badge-p3" style="margin-right:6px; font-weight:normal;">' + dict[key] + '</span><span style="color:var(--text-secondary); font-size:13px; text-decoration:line-through;">' + esc(oldVal || '空') + '</span></div>');
                            }
                        }
                    } catch(e) { console.log("解析载荷失败忽略"); }
                }

                beforeHtml = beforeContentArr.length > 0 ? beforeContentArr.join('') : '<span style="color:var(--text-secondary)">-</span>';
                afterHtml = newContentArr.length > 0 ? newContentArr.join('') : '<span style="color:var(--text-secondary)">无实质内容变更</span>';

            } else if (targetType.indexOf('project') !== -1 || targetType.indexOf('module') !== -1) {
                // 项目/模块改名逻辑
                var prefix = targetType.indexOf('review') !== -1 ? '审核区' : '用例仓库';
                var typeName = targetType.indexOf('project') !== -1 ? '项目' : '模块';
                eventText = '<div style="font-weight:700;">请求修改' + typeName + '名称</div><div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">所属：' + prefix + '</div>';

                beforeHtml = '<span style="text-decoration:line-through; color:var(--text-secondary); font-size: 14px;">' + esc(m.oldName || '未知') + '</span>';
                afterHtml = '<span style="color:var(--primary); font-weight:700; font-size: 14px;">' + esc(m.newName || '') + '</span>';
            } else {
                eventText = '未知系统事件';
            }

            html += '<tr style="border-bottom: 1px solid var(--border);">';
            // 【修改点 2】：将所有的 vertical-align:top 替换为 vertical-align:middle，实现上下绝对居中
            html += '<td style="padding:16px 20px; font-weight:600; color:var(--text-primary); vertical-align:middle;">' + esc(m.senderCn || m.sender || '未知') + '</td>';
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:middle;">' + eventText + '</td>';
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:middle; background: color-mix(in srgb, var(--text-secondary) 5%, transparent);">' + beforeHtml + '</td>';
            html += '<td style="padding:16px 20px; white-space:normal; line-height:1.5; vertical-align:middle;">' + afterHtml + '</td>';

            if(m.status === 'pending') {
                html += '<td style="padding:16px 20px; vertical-align:middle;"><span style="color:var(--warning); font-weight:700;">待审批</span></td>';
                if(isAdmin) {
                    // 【修改点 3】：操作列 td 内容左对齐 text-align:left，按钮容器靠左排列 justify-content:flex-start
                    html += '<td style="padding:16px 20px; text-align:left; vertical-align:middle;"><div style="display:flex; gap:8px; justify-content:flex-start;">';
                    html += '<button class="btn btn-small btn-success" onclick="handleMessageRequest('+m.id+', \'approve\')">通过</button>';
                    html += '<button class="btn btn-small btn-danger" onclick="handleMessageRequest('+m.id+', \'reject\')">驳回</button>';
                    html += '</div></td>';
                }
            } else {
                var sColor = m.status === 'approved' ? 'var(--success)' : 'var(--danger)';
                var sText = m.status === 'approved' ? '已通过' : '已驳回';
                html += '<td style="padding:16px 20px; vertical-align:middle;"><span style="color:'+sColor+'; font-weight:700;">'+sText+'</span></td>';
                if(isAdmin) {
                    // 【修改点 4】：即使是没有按钮的占位符(短横线)也改为左对齐 text-align:left
                    html += '<td style="padding:16px 20px; text-align:left; color:var(--text-secondary); vertical-align:middle;">-</td>';
                }
            }
            html += '</tr>';
        } catch (e) {
            console.error("渲染单条消息出错, 已跳过该条:", m, e);
        }
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// 管理员点击同意或驳回
async function handleMessageRequest(id, action) {
    try {
        const res = await authFetch('/api/message/'+id+'/handle', {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: action})
        });
        const data = await res.json();
        if(data.success) {
            showToast(action === 'approve' ? '审批通过，已强制应用改名' : '已驳回请求', 'success');

            // 【兼顾审核区的本地数据机制】：如果改的是审核区，手动为管理员变更一下缓存
            if(action === 'approve' && String(data.targetType).startsWith('review_')) {
                if(data.targetType === 'review_project') {
                    var pList = getReviewProjects();
                    var p = pList.find(function(x){ return x.id === data.targetId });
                    if(p) { p.name = data.newName; saveReviewProjects(pList); }
                } else {
                    var mList = getReviewModules();
                    var m = mList.find(function(x){ return x.id === data.targetId });
                    if(m) { m.name = data.newName; saveReviewModules(mList); }
                }
            }

            // 一键刷新所有界面上的旧名字！
            await fetchServerData();
            renderSidebar(); renderTestCaseView(); renderTaskTable(); renderReviewView();
            fetchMessages(); // 刷新红点
        } else {
            showToast(data.message, 'error');
        }
    } catch(e) { showToast('处理异常', 'error'); }
}

// 为了防止点外边关不掉铃铛，我们修补一下原代码里的全局点击事件：
window.onclick=function(e){
    if(!e.target.closest('.user-menu'))document.getElementById('userDropdown').classList.remove('show');
    if(!e.target.closest('.column-setting'))document.getElementById('columnDropdown').classList.remove('show');
    if(!e.target.closest('.message-menu')) { var m = document.getElementById('messageDropdown'); if(m) m.classList.remove('show'); }
}

// 【本次修改】：将本地开发环境的轮询时间从 5 秒放宽到 15 秒，避免彻底榨干 Windows 本地端口
setInterval(fetchMessages, 15000);

// 脚本末尾就地执行同步拦截逻辑，真正做到毫秒级加载
autoRestore();
