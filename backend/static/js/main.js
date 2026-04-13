var STORAGE_KEY='qa_testhub_v12_pro';
var currentUser=null,currentTab='dashboard',currentProject='',currentModule='',currentPage=1,pageSize=15,currentTheme='default',selectedCases=[],currentTaskFilter='myCharge',selectedAvatar='male',generatedCases=[];
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
        showToast('登录状态失效或未授权，请重新登录', 'error');
        
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
var expandedMenu={testcases:true,tasks:false}; 

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

const hierarchyIcons = {
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
};

var columnConfig=[['col-checkbox','勾选'],['col-id','序号'],['col-module','模块'],['col-point','测试点'],['col-level','等级'],['col-precondition','前置条件'],['col-steps','操作步骤'],['col-expected','预期结果'],['col-remark','备注'],['col-creator','创建人'],['col-executor','执行人'],['col-status','状态'],['col-actions','操作']];

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
            superadmin: ['dashboard','casegen','testcases','tasks','team','permission','settings','add_case','edit_case','delete_case','batch_delete_case','add_user','edit_user','delete_user','add_chart','update_status','assign_case','add_project','add_module'],
            admin: ['dashboard','casegen','testcases','tasks','team','settings','add_case','edit_case','delete_case','batch_delete_case','add_chart','update_status','assign_case','add_project','add_module'],
            tester: ['dashboard','casegen','testcases','tasks','add_case','edit_case','update_status']
        };
    }
    
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
            columns: {'col-checkbox':true,'col-id':true,'col-module':true,'col-point':true,'col-level':true,'col-precondition':true,'col-steps':true,'col-expected':true,'col-remark':true,'col-creator':true,'col-executor':true,'col-status':true,'col-actions':true}
        };
    }

    // 【关键修复】：找回被误杀的图表配置！顺便帮你把三种图表都默认配齐
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

    // 把基础配置写回本地，重点是加上 charts！
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        settings: localData.settings,
        ui: localData.ui,
        permissions: localData.permissions,
        charts: localData.charts // <--- 就是漏了这行
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
function showToast(message,type){var t=document.getElementById('toast');t.innerHTML=message;t.className='toast toast-'+type+' show';setTimeout(function(){t.classList.remove('show')},3000)}
function getRoleName(role){return({superadmin:'超级管理员',admin:'管理员',tester:'测试工程师'})[role]||role}
function hasPermission(perm){if(!currentUser)return false;var data=getData();return (data.permissions[currentUser.role]||[]).indexOf(perm)!==-1}
function closeAllPages(){document.querySelectorAll('.page-section').forEach(function(s){s.classList.remove('active')})}
function closeModal(id){document.getElementById(id).classList.remove('show')}
function toggleUserMenu(){document.getElementById('userDropdown').classList.toggle('show')}
function showRegister(){document.getElementById('loginFormBox').style.display='none';document.getElementById('registerFormBox').style.display='block'; clearRegErrors();}
function showLogin(){document.getElementById('loginFormBox').style.display='block';document.getElementById('registerFormBox').style.display='none'}

async function handleLogin() {
    var u = document.getElementById('username').value.trim();
    var p = document.getElementById('password').value;

    if(!u || !p) { showToast('用户名和密码不能为空！', 'error'); return; }

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
function loadUISettings(){var data=getData();var theme=(data.ui&&data.ui.theme)||'default';applyTheme(theme);pageSize=parseInt((data.settings&&data.settings.basic&&data.settings.basic.sysPageSize)||'15',10);document.getElementById('pageSize').value=String(pageSize)}
function applyTheme(theme){currentTheme=theme;document.documentElement.setAttribute('data-theme',theme==='default'?'':theme);var data=getData();if(!data.ui)data.ui={columns:{}};data.ui.theme=theme;setData(data)}
function toggleTheme(){var idx=themeOrder.indexOf(currentTheme);if(idx<0)idx=0;idx=(idx+1)%themeOrder.length;applyTheme(themeOrder[idx]);renderThemeOptions();showToast('已切换主题：'+themeMeta[currentTheme].name,'success')}
function openThemeConfig(){renderThemeOptions();document.getElementById('themeModal').classList.add('show')}
function renderThemeOptions(){var box=document.getElementById('themeOptions');var html='';themeOrder.forEach(function(key){html+='<div class="theme-option '+(currentTheme===key?'selected':'')+'" onclick="selectTheme(\''+key+'\')"><div class="theme-preview" style="background:'+themeMeta[key].preview+'"></div><div>'+themeMeta[key].name+'</div></div>'});box.innerHTML=html}
function selectTheme(theme){applyTheme(theme);renderThemeOptions();showToast('已切换主题：'+themeMeta[theme].name,'success')}

function toggleProjectExpand(e, id){
  e.stopPropagation();
  expandedMenu['proj_'+id] = expandedMenu['proj_'+id] === false ? true : false;
  renderSidebar();
}

function renderSidebar(){var data=getData(),nav=document.getElementById('sidebarNav');var html='';
  html+='<div class="nav-item"><div class="nav-link '+(currentTab==='dashboard'?'active':'')+'" onclick="switchPage(\'dashboard\')"><div class="nav-link-left"><span class="nav-icon">'+svgIcons.dashboard+'</span><span>首页</span></div></div></div>';
  html+='<div class="nav-divider"></div>'; 
  if(hasPermission('casegen'))html+='<div class="nav-item"><div class="nav-link '+(currentTab==='casegen'?'active':'')+'" onclick="switchPage(\'casegen\')"><div class="nav-link-left"><span class="nav-icon">'+svgIcons.casegen+'</span><span>用例生成</span></div></div></div>';
  
  var tcActive=(currentTab==='testcases');
  html+='<div class="nav-item"><div class="nav-link '+(tcActive?'active':'')+'"><div class="nav-link-left" onclick="switchPage(\'testcases\', true)"><span class="nav-icon">'+svgIcons.testcases+'</span><span>用例库</span></div><div class="expand-btn '+(expandedMenu.testcases?'expanded':'')+'" onclick="toggleExpand(event,\'testcases\')">▶</div></div><div class="submenu '+(expandedMenu.testcases?'open':'')+'">';
  data.projects.forEach(function(proj){
    var projActive=currentProject===String(proj.id)&&!currentModule;
    var isProjExpanded = expandedMenu['proj_'+proj.id] !== false; 
    
    html+='<div class="project-item '+(projActive?'active':'')+'" onclick="selectProject(\''+proj.id+'\',\''+esc(proj.name).replace(/'/g,'\\\'')+'\')">';
    html+='<div class="item-title"><span style="margin-right:4px;">'+hierarchyIcons.folder+'</span> <span>'+esc(proj.name)+'</span></div>';
    html+='<div class="item-actions">';
    html+='<div class="expand-btn '+(isProjExpanded?'expanded':'')+'" onclick="toggleProjectExpand(event,\''+proj.id+'\')">▶</div>';
    html+='</div></div>';

    html+='<div style="display:'+(isProjExpanded?'block':'none')+'">';
    html+='<div class="module-list-container">';
    (proj.modules||[]).forEach(function(mod){
      var modActive=currentModule===String(mod.id);
      html+='<div class="module-item '+(modActive?'active':'')+'" onclick="selectModule(\''+proj.id+'\',\''+mod.id+'\',\''+esc(mod.name).replace(/'/g,'\\\'')+'\')">';
      html+='<div class="item-title"><span style="margin-right:4px;">'+hierarchyIcons.file+'</span> <span>'+esc(mod.name)+'</span></div>';
      html+='</div>';
    });
    html+='</div>'; 
    html+='</div>';
  });
  html+='</div></div><div class="nav-divider"></div>';
  
  if(hasPermission('tasks')){
      html+='<div class="nav-item"><div class="nav-link '+(currentTab==='tasks'?'active':'')+'"><div class="nav-link-left" onclick="switchPage(\'tasks\')"><span class="nav-icon">'+svgIcons.tasks+'</span><span>全部任务</span></div><div class="expand-btn '+(expandedMenu.tasks?'expanded':'')+'" onclick="toggleExpand(event,\'tasks\')">▶</div></div><div class="submenu '+(expandedMenu.tasks?'open':'')+'">';
      [['myCharge','我负责的'],['myCreate','我创建的'],['myAssign','我分配的'],['completed','已完成']].forEach(function(item){
          html+='<div class="submenu-item '+(currentTab==='tasks'&&currentTaskFilter===item[0]?'active':'')+'" onclick="switchTaskFilter(\''+item[0]+'\',\''+item[1]+'\')"><div class="item-title"><span style="margin-right:4px;">'+taskSubIcons[item[0]]+'</span> <span>'+item[1]+'</span></div></div>'
      });
      html+='</div></div><div class="nav-divider"></div>';
  }
  
  if(hasPermission('team'))html+='<div class="nav-item"><div class="nav-link '+(currentTab==='team'?'active':'')+'" onclick="switchPage(\'team\')"><div class="nav-link-left"><span class="nav-icon">'+svgIcons.team+'</span><span>团队管理</span></div></div></div>';
  if(hasPermission('permission'))html+='<div class="nav-item"><div class="nav-link '+(currentTab==='permission'?'active':'')+'" onclick="switchPage(\'permission\')"><div class="nav-link-left"><span class="nav-icon">'+svgIcons.permission+'</span><span>权限配置</span></div></div></div>';
  if(hasPermission('settings'))html+='<div class="nav-item"><div class="nav-link '+(currentTab==='settings'?'active':'')+'" onclick="switchPage(\'settings\')"><div class="nav-link-left"><span class="nav-icon">'+svgIcons.settings+'</span><span>系统设置</span></div></div></div>';
  nav.innerHTML=html;
}

function clearCaseSelectionState(){
    currentProject=''; currentModule=''; selectedCases=[];
    localStorage.removeItem('qa_currentProject'); localStorage.removeItem('qa_currentModule');
}
function toggleExpand(e,menu){e.stopPropagation();expandedMenu[menu]=!expandedMenu[menu];renderSidebar()}

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
    
    var titles={dashboard:'首页',casegen:'用例生成',testcases:'用例库',tasks:'全部任务 - '+({'myCharge':'我负责的','myCreate':'我创建的','myAssign':'我分配的','completed':'已完成'})[currentTaskFilter],team:'团队管理',permission:'权限配置',settings:'系统设置'};
    document.getElementById('pageTitle').textContent=titles[page]||'首页';
    document.getElementById('columnDropdown').classList.remove('show');
    
    renderSidebar();
    
    if(page==='dashboard'){updateStats();renderCharts();}
    else if(page==='casegen'){populateGeneratorProjectSelect();renderGeneratedPreview();}
    else if(page==='testcases'){renderTestCaseView();}
    else if(page==='tasks'){document.getElementById('taskTitle').textContent='全部任务 - '+({'myCharge':'我负责的','myCreate':'我创建的','myAssign':'我分配的','completed':'已完成'})[currentTaskFilter];renderTaskTable();}
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
    currentProject='';
    currentModule='';
    closeAllPages();
    document.getElementById('page-tasks').classList.add('active');
    document.getElementById('pageTitle').textContent='全部任务 - '+name;
    document.getElementById('taskTitle').textContent='全部任务 - '+name;
    renderSidebar();
    renderTaskTable()
}

function renderTestCaseView() {
    var v1 = document.getElementById('tc-view-projects');
    var v2 = document.getElementById('tc-view-modules');
    var v3 = document.getElementById('tc-view-cases');
    
    v1.style.display = 'none'; v2.style.display = 'none'; v3.style.display = 'none';
    var data = getData();
    
    var displayTitle = '用例库';
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

    if (!currentProject) {
        v1.style.display = 'block';
        var html = '';
        if(!data.projects.length){
            html = '<div class="empty-state" style="grid-column: 1/-1">暂无项目页签，请新建。</div>';
        } else {
            data.projects.forEach(function(p){
                var modCount = (p.modules||[]).length;
                var delBtnProj = hasPermission('add_project') ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); deleteProject(\''+p.id+'\')">删除</button>' : '';
                // 【新增】超级管理员专属修改功能
                var editBtnProj = (currentUser && currentUser.role === 'superadmin') ? '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditProjectModal(\''+p.id+'\', \''+esc(p.name).replace(/'/g,'\\\'')+'\')">重命名</button>' : '';
                html += '<div class="grid-card" onclick="selectProject(\''+p.id+'\',\''+esc(p.name)+'\')">' +
                        editBtnProj + delBtnProj +
                        '<h3>' + hierarchyIcons.folder + ' ' + esc(p.name) + '</h3>' +
                        '<p style="margin-top:12px">当前包含 <strong>' + modCount + '</strong> 个二级测试模块</p>' +
                        '<div class="grid-card-footer">进入子页签 →</div></div>';
            });
        }
        document.getElementById('projectGrid').innerHTML = html;
    } 
    else if (currentProject && !currentModule) {
        var p = data.projects.find(function(x){return String(x.id)===String(currentProject)});
        if(!p) return;
        v2.style.display = 'block';
        var html = '';
        if(!(p.modules||[]).length){
            html = '<div class="empty-state" style="grid-column: 1/-1">当前页签下暂无测试模块，请点击右上角新建。</div>';
        } else {
            p.modules.forEach(function(m){
                var tcCount = (data.testcases||[]).filter(function(t){return String(t.moduleId)===String(m.id)}).length;
                var delBtnMod = hasPermission('add_module') ? '<button class="btn btn-small btn-danger card-del-btn" onclick="event.stopPropagation(); deleteModule(\''+p.id+'\',\''+m.id+'\')">删除</button>' : '';
                // 【新增】超级管理员专属修改功能
                var editBtnMod = (currentUser && currentUser.role === 'superadmin') ? '<button class="btn btn-small btn-primary card-edit-btn" onclick="event.stopPropagation(); openEditModuleModal(\''+p.id+'\', \''+m.id+'\', \''+esc(m.name).replace(/'/g,'\\\'')+'\')">重命名</button>' : '';
                html += '<div class="grid-card" onclick="selectModule(\''+p.id+'\',\''+m.id+'\',\''+esc(m.name)+'\')">' +
                        editBtnMod + delBtnMod +
                        '<h3>' + hierarchyIcons.file + ' ' + esc(m.name) + '</h3>' +
                        '<p style="margin-top:12px">当前包含 <strong>' + tcCount + '</strong> 条测试用例</p>' +
                        '<div class="grid-card-footer">管理测试用例 →</div></div>';
            });
        }
        document.getElementById('moduleGrid').innerHTML = html;
    } 
    else {
        v3.style.display = 'flex';
        renderTable();
    }
}

// 【新增核心功能】打开修改项目名称弹窗
function openEditProjectModal(id, name) {
    document.getElementById('editProjectId').value = id;
    document.getElementById('editProjectName').value = name;
    document.getElementById('editProjectModal').classList.add('show');
}

// 【真实接口版】保存修改项目名称
async function saveEditProject() {
    var id = document.getElementById('editProjectId').value;
    var newName = document.getElementById('editProjectName').value.trim();
    if (!newName) { showToast('名称不能为空', 'error'); return; }
    
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
        } else {
            showToast(result.message || '重命名失败', 'error');
        }
    } catch (e) { showToast('请求异常', 'error'); }
}

// 【新增核心功能】打开修改模块名称弹窗
function openEditModuleModal(projId, modId, name) {
    document.getElementById('editModProjId').value = projId;
    document.getElementById('editModId').value = modId;
    document.getElementById('editModName').value = name;
    document.getElementById('editModuleModal').classList.add('show');
}

// 【真实接口版】保存修改模块名称
async function saveEditModule() {
    var modId = document.getElementById('editModId').value;
    var newName = document.getElementById('editModName').value.trim();
    if (!newName) { showToast('名称不能为空', 'error'); return; }
    
    try {
        const res = await authFetch('/api/module/' + modId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const result = await res.json();
        if (result.success) {
            closeModal('editModuleModal');
            await fetchServerData(); // 重新拉取最新数据
            renderSidebar(); renderTestCaseView(); populateGeneratorProjectSelect(); renderTaskTable();
            showToast('模块重命名及关联用例更新成功', 'success');
        } else {
            showToast(result.message || '重命名失败', 'error');
        }
    } catch (e) { showToast('请求异常', 'error'); }
}

function openModuleModalCurrent() {
    if(!currentProject) { showToast('当前不在任何项目下','error'); return;}
    var data = getData();
    var p = data.projects.find(function(x){return String(x.id)===String(currentProject)});
    openModuleModal(p.id, p.name);
}

function getFilteredCases(){
    var data=getData();
    var search=(document.getElementById('searchInput').value||'').toLowerCase();
    var level=document.getElementById('filterLevel').value;
    var status=document.getElementById('filterStatus').value;
    return (data.testcases||[]).filter(function(tc){
        var match=true;
        if(search&&String(tc.point||'').toLowerCase().indexOf(search)===-1) match=false;
        if(level&&tc.level!==level) match=false;
        if(status&&tc.status!==status) match=false;
        if(String(tc.projectId)!==String(currentProject)) match=false;
        if(String(tc.moduleId)!==String(currentModule)) match=false;
        return match;
    })
}

function renderTableHeader(){var tr=document.querySelector('#tableHead tr');var html='';if(isColumnVisible('col-checkbox')){var visibleIds=getFilteredCases().map(function(x){return x.id});var allChecked=visibleIds.length&&visibleIds.every(function(id){return selectedCases.indexOf(id)!==-1})?'checked':'';html+='<th class="checkbox-col"><input type="checkbox" '+allChecked+' onchange="toggleSelectAll(this.checked)"></th>'}if(isColumnVisible('col-id'))html+='<th>序号</th>';if(isColumnVisible('col-module'))html+='<th>模块</th>';if(isColumnVisible('col-point'))html+='<th>测试点</th>';if(isColumnVisible('col-level'))html+='<th>等级</th>';if(isColumnVisible('col-precondition'))html+='<th>前置条件</th>';if(isColumnVisible('col-steps'))html+='<th>操作步骤</th>';if(isColumnVisible('col-expected'))html+='<th>预期结果</th>';if(isColumnVisible('col-remark'))html+='<th>备注</th>';if(isColumnVisible('col-creator'))html+='<th>创建人</th>';if(isColumnVisible('col-executor'))html+='<th>执行人</th>';if(isColumnVisible('col-status'))html+='<th>状态</th>';if(isColumnVisible('col-actions'))html+='<th>操作</th>';tr.innerHTML=html}

function renderTable(){
    var filtered=getFilteredCases();renderTableHeader();
    var total=filtered.length;var maxPage=Math.max(1,Math.ceil(total/pageSize));
    if(currentPage>maxPage)currentPage=maxPage;
    var start=(currentPage-1)*pageSize,end=Math.min(start+pageSize,total),pageData=filtered.slice(start,end);
    var html='';
    pageData.forEach(function(tc, index){
        // 【新增】：根据当前页码和所在行数，动态计算连续的序号
        var displayId = start + index + 1; 
        var levelClass=tc.level==='P1'?'badge-p1':tc.level==='P2'?'badge-p2':'badge-p3';
        
        html+='<tr>';
        if(isColumnVisible('col-checkbox'))html+='<td class="checkbox-col"><input type="checkbox" '+(selectedCases.indexOf(tc.id)!==-1?'checked':'')+' onchange="toggleCaseSelection('+tc.id+')"></td>';
        // 【修改】：原本显示 tc.id，现在改为显示连续的 displayId
        if(isColumnVisible('col-id'))html+='<td>'+displayId+'</td>';
        if(isColumnVisible('col-module'))html+='<td>'+esc(tc.moduleName||'-')+'</td>';
        if(isColumnVisible('col-point'))html+='<td>'+esc(tc.point)+'</td>';
        if(isColumnVisible('col-level'))html+='<td><span class="badge '+levelClass+'">'+tc.level+'</span></td>';
        if(isColumnVisible('col-precondition'))html+='<td style="white-space:pre-wrap;max-width:180px; font-size:13px; color:var(--text-secondary);">'+esc(tc.precondition||'-')+'</td>';
        if(isColumnVisible('col-steps'))html+='<td style="white-space:pre-wrap;max-width:220px; font-size:13px; line-height:1.5;">'+esc(tc.steps)+'</td>';
        if(isColumnVisible('col-expected'))html+='<td style="white-space:pre-wrap;max-width:220px; font-size:13px; line-height:1.5;">'+esc(tc.expected)+'</td>';
        if(isColumnVisible('col-remark'))html+='<td style="font-size:13px;">'+esc(tc.remark||'-')+'</td>';
        if(isColumnVisible('col-creator'))html+='<td style="font-size:13px;">'+esc(tc.creator||'-')+'</td>';
        if(isColumnVisible('col-executor'))html+='<td style="font-size:13px;">'+esc(tc.executor||'-')+'</td>';
        if(isColumnVisible('col-status')){
            if(hasPermission('update_status')){
                var sClass = tc.status === '通过' ? 'status-pass' : tc.status === '未通过' ? 'status-fail' : 'status-pending';
                html += '<td><select class="status-select ' + sClass + '" onchange="updateStatus('+tc.id+', this.value)">' +
                        '<option value="待测试" '+(tc.status==='待测试'?'selected':'')+'>待测试</option>' +
                        '<option value="通过" '+(tc.status==='通过'?'selected':'')+'>通过</option>' +
                        '<option value="未通过" '+(tc.status==='未通过'?'selected':'')+'>未通过</option>' +
                        '</select></td>';
            } else {
                var staticStatusClass=tc.status==='通过'?'badge-p3':tc.status==='未通过'?'badge-p1':'badge-p2';
                html += '<td><span class="badge '+staticStatusClass+'">'+tc.status+'</span></td>';
            }
        }
        if(isColumnVisible('col-actions')){
            html+='<td class="actions">';
            if(hasPermission('edit_case'))html+='<button class="btn btn-small btn-primary" onclick="editTestCase('+tc.id+')">编辑</button> ';
            if(hasPermission('delete_case'))html+='<button class="btn btn-small btn-danger" onclick="deleteTestCase('+tc.id+')">删除</button>';
            html+='</td>'
        }
        html+='</tr>';
    });
    document.getElementById('tableBody').innerHTML=html||'<tr><td colspan="13" class="empty-state">当前模块下暂无符合条件的用例数据</td></tr>';
    document.getElementById('pageInfo').textContent='显示 '+(total?start+1:0)+'-'+end+' 共 '+total+' 条';
    renderPageBtns(Math.ceil(total/pageSize)||1);updateBatchActions();
}

function renderPageBtns(totalPages){var html='<button class="page-btn" onclick="changePage(-1)" '+(currentPage<=1?'disabled':'')+'>上一页</button>';for(var i=1;i<=totalPages;i++){if(i===1||i===totalPages||(i>=currentPage-2&&i<=currentPage+2))html+='<button class="page-btn '+(i===currentPage?'active':'')+'" onclick="goPage('+i+')">'+i+'</button>';else if(i===currentPage-3||i===currentPage+3)html+='<span>...</span>'}html+='<button class="page-btn" onclick="changePage(1)" '+(currentPage>=totalPages?'disabled':'')+'>下一页</button>';document.getElementById('pageBtns').innerHTML=html}
function changePage(delta){currentPage+=delta; localStorage.setItem('qa_currentPage', currentPage); renderTable()}
function goPage(page){currentPage=page; localStorage.setItem('qa_currentPage', currentPage); renderTable()}
function changePageSize(){
    pageSize=parseInt(document.getElementById('pageSize').value,10);
    var data=getData();
    if(!data.settings)data.settings={};
    if(!data.settings.basic)data.settings.basic={};
    data.settings.basic.sysPageSize=String(pageSize);
    setData(data);
    currentPage=1;
    localStorage.setItem('qa_currentPage', currentPage);
    renderTable();
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
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ids: selectedCases,
                executor: executor,
                assignedBy: currentUser.username
            })
        });
        const result = await res.json();
        if(result.success){
            closeModal('assignModal'); clearSelection();
            await fetchServerData();
            renderTaskTable(); renderTestCaseView();
            showToast('任务分配成功！','success');
        }
    } catch(e) { showToast('分配异常', 'error'); }
}

function fillProjectAndModuleSelect(projectElId,moduleElId,selectedProjectId,selectedModuleId){var data=getData(),p=document.getElementById(projectElId),m=document.getElementById(moduleElId);var pHtml='<option value="">请选择项目</option>';data.projects.forEach(function(proj){pHtml+='<option value="'+proj.id+'">'+esc(proj.name)+'</option>'});p.innerHTML=pHtml;p.value=selectedProjectId||'';function fillModules(){var proj=data.projects.find(function(x){return String(x.id)===String(p.value)});var mHtml='<option value="">请选择模块</option>';((proj&&proj.modules)||[]).forEach(function(mod){mHtml+='<option value="'+mod.id+'">'+esc(mod.name)+'</option>'});m.innerHTML=mHtml;if(selectedModuleId)m.value=selectedModuleId||''}p.onchange=function(){selectedModuleId='';fillModules()};fillModules()}

function openTestModal(){document.getElementById('testModalTitle').textContent='新增测试用例';document.getElementById('testId').value='';fillProjectAndModuleSelect('testProject','testModule',currentProject||'',currentModule||'');document.getElementById('testPoint').value='';document.getElementById('testLevel').value='P1';document.getElementById('testPrecondition').value='';document.getElementById('testSteps').value='';document.getElementById('testExpected').value='';document.getElementById('testRemark').value='';document.getElementById('testModal').classList.add('show')}
function editTestCase(id){var data=getData();var tc=data.testcases.find(function(x){return x.id===id});if(!tc)return;document.getElementById('testModalTitle').textContent='编辑测试用例';document.getElementById('testId').value=tc.id;fillProjectAndModuleSelect('testProject','testModule',tc.projectId,tc.moduleId);document.getElementById('testPoint').value=tc.point;document.getElementById('testLevel').value=tc.level;document.getElementById('testPrecondition').value=tc.precondition||'';document.getElementById('testSteps').value=tc.steps;document.getElementById('testExpected').value=tc.expected;document.getElementById('testRemark').value=tc.remark||'';document.getElementById('testModal').classList.add('show')}

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

function renderTaskTable(){
    var search=(document.getElementById('taskSearchInput').value||'').toLowerCase();
    var data=getData();
    var filtered=(data.testcases||[]).filter(function(tc){
        var match=false;
        if(currentTaskFilter==='myCharge'&&tc.executor===currentUser.username)match=true;
        else if(currentTaskFilter==='myCreate'&&tc.creator===currentUser.username)match=true;
        else if(currentTaskFilter==='myAssign'&&tc.assignedBy===currentUser.username)match=true;
        else if(currentTaskFilter==='completed'&&tc.status==='通过')match=true;
        if(search&&String(tc.point||'').toLowerCase().indexOf(search)===-1)match=false;
        return match;
    });
    var html='';
    filtered.forEach(function(tc, index){
        // 【新增】：动态计算连续的序号 (因为任务列表通常不分页，所以直接从1开始)
        var displayId = index + 1;
        var levelClass=tc.level==='P1'?'badge-p1':tc.level==='P2'?'badge-p2':'badge-p3';
        // 【修改】：把 <td>'+tc.id+'</td> 改成了 <td>'+displayId+'</td>
        html+='<tr><td>'+displayId+'</td><td>'+esc(tc.projectName||'-')+'</td><td>'+esc(tc.moduleName||'-')+'</td><td>'+esc(tc.point)+'</td><td><span class="badge '+levelClass+'">'+tc.level+'</span></td><td style="white-space:pre-wrap;max-width:180px; font-size:13px;">'+esc(tc.precondition||'-')+'</td><td style="white-space:pre-wrap;max-width:180px; font-size:13px; line-height:1.5;">'+esc(tc.steps||'-')+'</td><td style="white-space:pre-wrap;max-width:180px; font-size:13px; line-height:1.5;">'+esc(tc.expected||'-')+'</td><td style="font-size:13px;">'+esc(tc.remark||'-')+'</td><td style="font-size:13px;">'+esc(tc.creator||'-')+'</td><td style="font-size:13px;">'+esc(tc.executor||'-')+'</td>';
        
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
        
        html+='<td class="actions">';
        if(hasPermission('edit_case'))html+='<button class="btn btn-small btn-primary" onclick="editTestCase('+tc.id+')">编辑</button> ';
        if(hasPermission('delete_case'))html+='<button class="btn btn-small btn-danger" onclick="deleteTestCase('+tc.id+')">删除</button>';
        html+='</td></tr>';
    });
    document.getElementById('taskTableBody').innerHTML=html||'<tr><td colspan="13" class="empty-state">当前未找到任何相关任务数据</td></tr>';
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
        ['dashboard','首页访问'],['casegen','用例生成'],['testcases','用例库访问'],['tasks','全部任务'],['team','团队管理'],['permission','权限管理'],['settings','系统设置'],
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

function populateGeneratorProjectSelect(){fillProjectAndModuleSelect('genProject','genModule',currentProject||'',currentModule||'')}

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
function inferCaseFromLine(line,index){var pure=line.replace(/^[-*•\d.、\s]+/,'').trim();return {point:pure||('自动生成用例'+(index+1)),level:index<2?'P1':index<5?'P2':'P3',precondition:'保证系统前置环境正常',steps:'1. 进入对应功能页面\n2. 依据“'+pure+'”执行操作\n3. 观察执行结果',expected:'系统能正确响应“'+pure+'”，无异常报错',remark:'AI/规则抽取'} }
function generateCasesFromInput(){var text=document.getElementById('genPrompt').value.trim();var projectId=document.getElementById('genProject').value,moduleId=document.getElementById('genModule').value;if(!projectId||!moduleId){showToast('请选择目标项目与模块','error');return}if(!text){showToast('请输入文档内容','error');return}var lines=normalizeGeneratorLines(text);if(!lines.length){showToast('未提取到有效操作点','error');return}var data=getData();var proj=data.projects.find(function(x){return String(x.id)===String(projectId)}),mod=(proj.modules||[]).find(function(x){return String(x.id)===String(moduleId)});generatedCases=lines.slice(0,100).map(function(line,idx){var base=inferCaseFromLine(line,idx);return {id:'gen_'+Date.now()+'_'+idx,projectId:proj.id,projectName:proj.name,moduleId:mod.id,moduleName:mod.name,point:base.point,level:base.level,precondition:base.precondition,steps:base.steps,expected:base.expected,remark:base.remark,status:'待测试',creator:currentUser.username,executor:'',assignedBy:''}});renderGeneratedPreview();showToast('智能解析成功，共 '+generatedCases.length+' 条用例','success')}
function renderGeneratedPreview(){var box=document.getElementById('generatedPreview');if(!generatedCases.length){box.className='empty-state generator-preview';box.innerHTML='暂无生成结果，请先输入需求文本';return}box.className='generator-preview';box.innerHTML=generatedCases.map(function(tc,idx){return '<div class="case-preview-item"><h4>'+(idx+1)+'. '+esc(tc.point)+'</h4><div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;"><strong>所属模块：</strong>'+esc(tc.projectName)+' / '+esc(tc.moduleName)+'</div><div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;"><strong>等级：</strong>'+tc.level+'</div><div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;"><strong>前置：</strong>'+esc(tc.precondition)+'</div><div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;"><strong>步骤：</strong><div style="white-space:pre-wrap; margin-top:2px;">'+esc(tc.steps)+'</div></div><div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;"><strong>预期：</strong><div style="white-space:pre-wrap; margin-top:2px;">'+esc(tc.expected)+'</div></div><div style="font-size:13px; color:var(--text-secondary);"><strong>备注：</strong>'+esc(tc.remark)+'</div></div>'}).join('')}

// 保存生成的用例到数据库
async function saveGeneratedCases(){
    if(!generatedCases.length){showToast('未找到可保存的内容','error');return}
    
    try {
        const res = await authFetch('/api/testcase/batch_add', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(generatedCases)
        });
        const result = await res.json();
        
        if(result.success){
            generatedCases = []; // 清空预览区
            await fetchServerData(); // 拉取最新数据库数据
            renderGeneratedPreview(); 
            renderTestCaseView(); 
            renderTaskTable(); 
            updateStats(); 
            renderCharts();
            showToast('生成用例已成功保存入库','success');
        } else {
            showToast('保存失败', 'error');
        }
    } catch(e) { 
        showToast('请求异常', 'error'); 
        console.error(e);
    }
}

function clearGeneratedCases(){generatedCases=[];document.getElementById('genPrompt').value='';renderGeneratedPreview()}

window.onclick=function(e){if(!e.target.closest('.user-menu'))document.getElementById('userDropdown').classList.remove('show');if(!e.target.closest('.column-setting'))document.getElementById('columnDropdown').classList.remove('show')}
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.modal.show').forEach(function(m){m.classList.remove('show')})})

// ----------------------------------------------------
// 核心状态还原引擎：基于 JWT 强校验的恢复机制
// ----------------------------------------------------
async function autoRestore() {
    try {
        // 第一关：检查本地有没有 Token
        var token = localStorage.getItem('qa_token');
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
            currentPage = parseInt(localStorage.getItem('qa_currentPage') || '1', 10);
            var lastTab = localStorage.getItem('qa_currentTab') || 'dashboard';
            
            applyPermissions();
            loadSettings();
            populateGeneratorProjectSelect();
            
            // 恢复左侧多级菜单的展开状态
            if(currentProject) {
                expandedMenu.testcases = true;
                expandedMenu['proj_' + currentProject] = true;
            }
            if(lastTab === 'tasks') expandedMenu.tasks = true;
            
            currentTab = lastTab;
            closeAllPages();
            var pEl = document.getElementById('page-'+lastTab);
            if(pEl) pEl.classList.add('active');
            
            var titles={dashboard:'首页',casegen:'用例生成',tasks:'全部任务',team:'团队管理',permission:'权限配置',settings:'系统设置'};
            if (lastTab !== 'testcases') { document.getElementById('pageTitle').textContent = titles[lastTab]||'首页'; }
            
            renderSidebar();
            
            if(lastTab==='dashboard'){updateStats();renderCharts();}
            else if(lastTab==='casegen'){populateGeneratorProjectSelect();renderGeneratedPreview();}
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

// 脚本末尾就地执行同步拦截逻辑，真正做到毫秒级加载
autoRestore();