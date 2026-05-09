const fs = require('fs');
const path = require('path');

function stripCommentsFromFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');

        content = content.replace(/^\s*\/\/.*$/gm, '');

        content = content.replace(/ \/\/ .*$/gm, '');

        content = content.replace(/\/\*[\s\S]*?\*\//g, '');

        if (filePath.endsWith('.html')) {
            content = content.replace(/<!--[\s\S]*?-->/g, '');
        }

        content = content.replace(/^\s*[\r\n]/gm, '\n');

        fs.writeFileSync(filePath, content);
        console.log(`Stripped comments from: ${filePath}`);
    } catch (e) {
        console.error(`Error processing ${filePath}:`, e);
    }
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'KeySlayer old') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.html') || fullPath.endsWith('.css')) {
            stripCommentsFromFile(fullPath);
        }
    }
}

processDir(path.resolve('.'));
console.log('Done removing comments.');
