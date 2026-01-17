/**
 * Electron 主进程
 *
 * CinemaForge 剧本工坊 - 桌面应用入口
 */

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// 保持对窗口对象的全局引用，避免被垃圾回收
let mainWindow;

/**
 * 创建应用窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        backgroundColor: '#fafafa', // slate-50 (Light Theme)
        // icon: path.join(__dirname, 'assets/icon.png'), // Icon not found
        title: 'CinemaForge 剧本工坊 v0.2',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false // Allow loading local resources in dev mode
        }
    });

    // Check for dev mode
    const isDev = process.argv.includes('--dev');

    if (isDev) {
        // 开发模式：加载本地服务
        console.log('Running in Development Mode: Loading http://localhost:3000');
        mainWindow.loadURL('http://localhost:3000').catch(e => {
            console.error('Failed to load localhost:3000', e);
            // Fallback to file if server not ready
            const indexUrl = path.join(__dirname, 'dist/index.html');
            mainWindow.loadFile(indexUrl);
        });
    } else {
        // 生产模式：加载构建文件
        const indexUrl = path.join(__dirname, 'dist/index.html');
        mainWindow.loadFile(indexUrl);
    }

    // 窗口准备好后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // 打开开发者工具（调试用，发布时可以注释掉）
        // mainWindow.webContents.openDevTools();
    });

    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // 阻止外部链接在应用内打开
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

/**
 * 创建菜单
 */
function createMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                {
                    label: '刷新',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        if (mainWindow) mainWindow.reload();
                    }
                },
                { type: 'separator' },
                {
                    label: '退出',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: '重做', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '关于',
                    click: () => {
                        require('electron').dialog.showMessageBox({
                            title: '关于 CinemaForge',
                            message: 'CinemaForge 剧本工坊',
                            detail: '版本: v0.2 轻量版\n\nAI驱动的短剧剧本创作与分镜生成系统',
                            buttons: ['确定']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * App 事件监听
 */

// 应用启动时创建窗口
app.on('ready', () => {
    createWindow();
    createMenu();
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOS 点击 Dock 图标时重新创建窗口
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// 处理任何未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});
