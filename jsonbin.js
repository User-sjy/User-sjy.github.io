// jsonbin.js
const API_URL = './api.php';

// ========== 基础函数 ==========

async function handleResponse(res) {
    // 检查 HTTP 状态码
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
    }
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`返回的不是 JSON，收到: ${text.substring(0, 200)}`);
    }
    
    return res.json();
}

export async function loadData() {
    const res = await fetch(`${API_URL}?action=load`);
    const result = await handleResponse(res);
    // api.php 返回的是 {status, message, data, timestamp}，需要取 data
    return result.data ?? result;
}

export async function saveData(data) {
    const res = await fetch(`${API_URL}?action=save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await handleResponse(res);
    return result.data ?? result;
}

export async function updateData(newData) {
    const res = await fetch(`${API_URL}?action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
    });
    const result = await handleResponse(res);
    return result.data ?? result;
}

// ========== 查找值 ==========
export async function findValue(path) {
    try {
        const data = await loadData();
        const keys = path.split('.');
        
        let current = data;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (current === undefined || current === null || current[key] === undefined) {
                console.log(`⚠️ 路径不存在: ${path}`);
                return undefined;
            }
            current = current[key];
        }
        
        console.log(`🔍 ${path} = ${current}`);
        return current;
    } catch (err) {
        console.error(`❌ 查找失败: ${err.message}`);
        return undefined;
    }
}

// ========== 修改值 ==========
export async function setValue(path, value) {
    try {
        const data = await loadData();
        const keys = path.split('.');
        
        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        await saveData(data);
        
        console.log(`✅ 修改成功: ${path} = ${value} (原值: ${oldValue})`);
        return { success: true, path, oldValue, newValue: value };
    } catch (err) {
        console.error(`❌ 修改失败: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// ========== 增加值 ==========
export async function addValue(path, increment) {
    try {
        const data = await loadData();
        const keys = path.split('.');
        
        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        
        let newValue;
        if (typeof oldValue === 'number') {
            newValue = oldValue + increment;
        } else {
            newValue = increment;
        }
        
        current[lastKey] = newValue;
        await saveData(data);
        
        console.log(`✅ 增加成功: ${path} 从 ${oldValue} 增加到 ${newValue} (+${increment})`);
        return { success: true, path, oldValue, newValue, increment };
    } catch (err) {
        console.error(`❌ 增加失败: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * 创建新用户
 * @param {string} email - 用户邮箱
 * @param {string} userName - 用户名
 * @param {string} password - 密码
 * @param {string} phoneNumber - 手机号（可选）
 * @returns {Promise<object>} 操作结果
 */
export async function createUser(email, userName, password, phoneNumber = '') {
    try {
        
        // 1. 检查用户名是否已存在（遍历检查）
        const data = await loadData();
        if (data.users) {
            for (const [key, user] of Object.entries(data.users)) {
                if (user.userName === userName) {
                    return { success: false, error: '用户名已被占用' };
                }
            }
        }
        
        // 2. 创建用户数据结构
        const newUser = {
            userName: userName,
            password: password,
            phoneNumber: phoneNumber,
            email: email,
            score: 0,
            passed: 0,
            avgPassed: 0,
            submissions: 0,
            pass: []
        };
        
        // 4. 保存到云端
        if (!data.users) data.users = {};
        data.users[email] = newUser;
        
        await updateData(data);
        
        console.log(`✅ 用户创建成功: ${userName} (${email})`);
        return { 
            success: true, 
            user: newUser,
            message: '注册成功'
        };
    } catch (err) {
        console.error(`❌ 创建用户失败: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * 获取用户信息
 * @param {string} email - 用户邮箱
 * @returns {Promise<object|null>} 用户信息
 */
export async function getUser(email) {
    const user = await findValue(`users.${email}`);
    return user || null;
}

/**
 * 验证用户登录
 * @param {string} email - 用户邮箱
 * @param {string} password - 密码
 * @returns {Promise<object>} 验证结果
 */
export async function verifyUser(email, password) {
    try {
        const user = await getUser(email);
        
        if (!user) {
            return { success: false, error: '用户不存在' };
        }
        
        if (user.password !== password) {
            return { success: false, error: '密码错误' };
        }
        
        console.log(`✅ 用户登录成功: ${user.userName}`);
        return { 
            success: true, 
            user: user,
            message: '登录成功'
        };
    } catch (err) {
        console.error(`❌ 验证失败: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * 更新用户信息
 * @param {string} email - 用户邮箱
 * @param {object} updates - 要更新的字段
 * @returns {Promise<object>} 操作结果
 */
export async function updateUser(email, updates) {
    try {
        const data = await loadData();
        
        if (!data.users || !data.users[email]) {
            return { success: false, error: '用户不存在' };
        }
        
        // 更新用户信息
        data.users[email] = {
            ...data.users[email],
            ...updates,
            lastUpdateTime: new Date().toISOString()
        };
        
        await saveData(data);
        
        console.log(`✅ 用户信息更新成功: ${email}`);
        return { success: true, user: data.users[email] };
    } catch (err) {
        console.error(`❌ 更新失败: ${err.message}`);
        return { success: false, error: err.message };
    }
}