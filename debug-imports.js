const fs = require('fs');
const path = require('path');

console.log('=== 开始调试导入问题 ===\n');

// 检查 src/main 目录下的所有文件
const srcDir = path.join(__dirname, 'src/main');

function checkFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            checkFiles(fullPath);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // 检查是否在顶层有 app.getPath() 的调用
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('app.getPath') && !line.includes('//') && !line.includes('/*')) {
                    // 检查这是不是在函数内部
                    let inFunction = false;
                    let braceCount = 0;
                    for (let j = 0; j < i; j++) {
                        const prevLine = lines[j];
                        braceCount += (prevLine.match(/{/g) || []).length;
                        braceCount -= (prevLine.match(/}/g) || []).length;
                        if (prevLine.includes('function ') || prevLine.includes('=>') || prevLine.includes('class ')) {
                            inFunction = true;
                        }
                    }
                    if (!inFunction || braceCount === 0) {
                        console.log(`⚠️  潜在问题: ${fullPath}:${i + 1}`);
                        console.log(`   内容: ${line.trim()}\n`);
                    }
                }
            }
        }
    }
}

checkFiles(srcDir);

console.log('\n=== 检查完成 ===');
