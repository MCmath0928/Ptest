const fs = require('fs');
const path = require('path');

// 数据文件路径
const DATA_FILE = path.join(process.cwd(), 'data', 'quiz_results.json');

// 确保数据目录存在
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 读取数据文件
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取数据文件失败:', error);
    }
    return [];
}

// 写入数据文件
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('写入数据文件失败:', error);
        return false;
    }
}

module.exports = async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method } = req;
    const { action, password, ...body } = req.body || {};
    const query = req.query;

    try {
        // 管理员密码验证函数
        const verifyAdmin = (pwd) => {
            const adminPassword = process.env.ADMIN_PASSWORD || 'LSY31415926';
            return pwd === adminPassword;
        };

        // 保存测试结果
        if (method === 'POST' && (!action || action === 'save')) {
            const userData = body;
            
            if (!userData.username || !userData.resultAnimal) {
                return res.status(400).json({ 
                    success: false, 
                    message: '缺少必要字段' 
                });
            }
            
            userData.timestamp = userData.timestamp || Date.now();
            userData.id = Date.now().toString();
            
            const allData = readData();
            allData.push(userData);
            
            const success = writeData(allData);
            
            if (success) {
                return res.json({ 
                    success: true, 
                    message: '数据保存成功',
                    id: userData.id
                });
            } else {
                return res.status(500).json({ 
                    success: false, 
                    message: '数据保存失败' 
                });
            }
        }

        // 获取所有数据（管理员用）
        if (method === 'GET' && query.action === 'getAll') {
            if (!verifyAdmin(query.password)) {
                return res.status(401).json({ 
                    success: false, 
                    message: '未授权访问' 
                });
            }
            
            const allData = readData();
            return res.json({ 
                success: true, 
                data: allData 
            });
        }

        // 获取统计数据
        if (method === 'GET' && query.action === 'getStats') {
            const allData = readData();
            
            const stats = {
                totalTests: allData.length,
                uniqueUsers: new Set(allData.map(item => item.username)).size,
                animalDistribution: {},
                recentTests: allData.slice(-10).reverse()
            };
            
            allData.forEach(item => {
                const animal = item.resultAnimal || '未知';
                stats.animalDistribution[animal] = (stats.animalDistribution[animal] || 0) + 1;
            });
            
            return res.json({ 
                success: true, 
                stats 
            });
        }

        // 清空数据（管理员用）
        if (method === 'POST' && action === 'clear') {
            if (!verifyAdmin(password)) {
                return res.status(401).json({ 
                    success: false, 
                    message: '未授权访问' 
                });
            }
            
            const success = writeData([]);
            
            if (success) {
                return res.json({ 
                    success: true, 
                    message: '数据已清空' 
                });
            } else {
                return res.status(500).json({ 
                    success: false, 
                    message: '清空数据失败' 
                });
            }
        }

        // 默认响应
        res.status(404).json({ 
            success: false, 
            message: '接口不存在' 
        });

    } catch (error) {
        console.error('服务器错误:', error);
        res.status(500).json({ 
            success: false, 
            message: '服务器内部错误' 
        });
    }
};