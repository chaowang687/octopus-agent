#!/usr/bin/env node

/**
 * 简易记事本应用 - 主入口文件
 * 一个命令行记事本应用，支持本地存储和CRUD操作
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

// 配置文件路径
const DATA_DIR = path.join(__dirname, 'data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化笔记数据文件
if (!fs.existsSync(NOTES_FILE)) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify([], null, 2));
}

/**
 * 读取所有笔记
 * @returns {Array} 笔记数组
 */
function readNotes() {
  try {
    const data = fs.readFileSync(NOTES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(chalk.red('读取笔记文件失败:'), error.message);
    return [];
  }
}

/**
 * 保存笔记
 * @param {Array} notes 笔记数组
 */
function saveNotes(notes) {
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error(chalk.red('保存笔记失败:'), error.message);
  }
}

/**
 * 显示主菜单
 */
async function showMainMenu() {
  console.clear();
  console.log(chalk.cyan('========================================'));
  console.log(chalk.cyan('          简易记事本 v1.0.0'));
  console.log(chalk.cyan('========================================'));
  console.log('');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作:',
      choices: [
        { name: '📝 创建新笔记', value: 'create' },
        { name: '📋 查看所有笔记', value: 'list' },
        { name: '🔍 搜索笔记', value: 'search' },
        { name: '✏️ 编辑笔记', value: 'edit' },
        { name: '🗑️ 删除笔记', value: 'delete' },
        { name: '📊 统计信息', value: 'stats' },
        { name: '🚪 退出', value: 'exit' }
      ]
    }
  ]);
  
  return action;
}

/**
 * 创建新笔记
 */
async function createNote() {
  console.clear();
  console.log(chalk.cyan('创建新笔记'));
  console.log(chalk.gray('----------------------------------------'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: '笔记标题:',
      validate: input => input.trim() ? true : '标题不能为空'
    },
    {
      type: 'input',
      name: 'content',
      message: '笔记内容:',
      validate: input => input.trim() ? true : '内容不能为空'
    },
    {
      type: 'list',
      name: 'priority',
      message: '优先级:',
      choices: [
        { name: '🔴 高', value: 'high' },
        { name: '🟡 中', value: 'medium' },
        { name: '🟢 低', value: 'low' }
      ],
      default: 'medium'
    }
  ]);
  
  const notes = readNotes();
  const newNote = {
    id: uuidv4(),
    title: answers.title.trim(),
    content: answers.content.trim(),
    priority: answers.priority,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  notes.push(newNote);
  saveNotes(notes);
  
  console.log('');
  console.log(chalk.green('✅ 笔记创建成功!'));
  console.log(chalk.gray(`ID: ${newNote.id}`));
  console.log(chalk.gray(`标题: ${newNote.title}`));
  
  await waitForContinue();
}

/**
 * 列出所有笔记
 */
async function listNotes() {
  console.clear();
  console.log(chalk.cyan('所有笔记'));
  console.log(chalk.gray('----------------------------------------'));
  
  const notes = readNotes();
  
  if (notes.length === 0) {
    console.log(chalk.yellow('📭 暂无笔记'));
  } else {
    notes.forEach((note, index) => {
      const priorityColor = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[note.priority] || chalk.white;
      
      console.log(`${index + 1}. ${priorityColor(`[${note.priority.toUpperCase()}]`)} ${note.title}`);
      console.log(chalk.gray(`   ${note.content.substring(0, 50)}${note.content.length > 50 ? '...' : ''}`));
      console.log(chalk.gray(`   创建时间: ${new Date(note.createdAt).toLocaleString()}`));
      console.log('');
    });
  }
  
  await waitForContinue();
}

/**
 * 搜索笔记
 */
async function searchNotes() {
  console.clear();
  console.log(chalk.cyan('搜索笔记'));
  console.log(chalk.gray('----------------------------------------'));
  
  const { keyword } = await inquirer.prompt([
    {
      type: 'input',
      name: 'keyword',
      message: '搜索关键词:',
      validate: input => input.trim() ? true : '请输入搜索关键词'
    }
  ]);
  
  const notes = readNotes();
  const searchTerm = keyword.toLowerCase().trim();
  const results = notes.filter(note => 
    note.title.toLowerCase().includes(searchTerm) || 
    note.content.toLowerCase().includes(searchTerm)
  );
  
  console.clear();
  console.log(chalk.cyan(`搜索结果 (${results.length} 条)`));
  console.log(chalk.gray('----------------------------------------'));
  
  if (results.length === 0) {
    console.log(chalk.yellow(`未找到包含 "${keyword}" 的笔记`));
  } else {
    results.forEach((note, index) => {
      const priorityColor = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[note.priority] || chalk.white;
      
      console.log(`${index + 1}. ${priorityColor(`[${note.priority.toUpperCase()}]`)} ${note.title}`);
      console.log(chalk.gray(`   ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`));
      console.log('');
    });
  }
  
  await waitForContinue();
}

/**
 * 编辑笔记
 */
async function editNote() {
  console.clear();
  console.log(chalk.cyan('编辑笔记'));
  console.log(chalk.gray('----------------------------------------'));
  
  const notes = readNotes();
  
  if (notes.length === 0) {
    console.log(chalk.yellow('📭 暂无笔记可编辑'));
    await waitForContinue();
    return;
  }
  
  const noteChoices = notes.map((note, index) => ({
    name: `${index + 1}. ${note.title} (${new Date(note.createdAt).toLocaleDateString()})`,
    value: note.id
  }));
  
  const { noteId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'noteId',
      message: '选择要编辑的笔记:',
      choices: noteChoices
    }
  ]);
  
  const noteIndex = notes.findIndex(note => note.id === noteId);
  const note = notes[noteIndex];
  
  console.clear();
  console.log(chalk.cyan(`编辑笔记: ${note.title}`));
  console.log(chalk.gray('----------------------------------------'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: '笔记标题:',
      default: note.title
    },
    {
      type: 'input',
      name: 'content',
      message: '笔记内容:',
      default: note.content
    },
    {
      type: 'list',
      name: 'priority',
      message: '优先级:',
      choices: [
        { name: '🔴 高', value: 'high' },
        { name: '🟡 中', value: 'medium' },
        { name: '🟢 低', value: 'low' }
      ],
      default: note.priority
    }
  ]);
  
  notes[noteIndex] = {
    ...note,
    title: answers.title.trim(),
    content: answers.content.trim(),
    priority: answers.priority,
    updatedAt: new Date().toISOString()
  };
  
  saveNotes(notes);
  
  console.log('');
  console.log(chalk.green('✅ 笔记更新成功!'));
  
  await waitForContinue();
}

/**
 * 删除笔记
 */
async function deleteNote() {
  console.clear();
  console.log(chalk.cyan('删除笔记'));
  console.log(chalk.gray('----------------------------------------'));
  
  const notes = readNotes();
  
  if (notes.length === 0) {
    console.log(chalk.yellow('📭 暂无笔记可删除'));
    await waitForContinue();
    return;
  }
  
  const noteChoices = notes.map((note, index) => ({
    name: `${index + 1}. ${note.title} (${new Date(note.createdAt).toLocaleDateString()})`,
    value: note.id
  }));
  
  const { noteId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'noteId',
      message: '选择要删除的笔记:',
      choices: noteChoices
    }
  ]);
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '确定要删除这个笔记吗?',
      default: false
    }
  ]);
  
  if (confirm) {
    const filteredNotes = notes.filter(note => note.id !== noteId);
    saveNotes(filteredNotes);
    console.log('');
    console.log(chalk.green('✅ 笔记删除成功!'));
  } else {
    console.log('');
    console.log(chalk.yellow('❌ 取消删除'));
  }
  
  await waitForContinue();
}

/**
 * 显示统计信息
 */
async function showStats() {
  console.clear();
  console.log(chalk.cyan('统计信息'));
  console.log(chalk.gray('----------------------------------------'));
  
  const notes = readNotes();
  const totalNotes = notes.length;
  
  if (totalNotes === 0) {
    console.log(chalk.yellow('📭 暂无笔记'));
  } else {
    // 按优先级统计
    const priorityStats = notes.reduce((acc, note) => {
      acc[note.priority] = (acc[note.priority] || 0) + 1;
      return acc;
    }, {});
    
    // 计算平均内容长度
    const totalContentLength = notes.reduce((sum, note) => sum + note.content.length, 0);
    const avgContentLength = Math.round(totalContentLength / totalNotes);
    
    // 最近创建的笔记
    const sortedByDate = [...notes].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    console.log(chalk.white(`📊 总笔记数: ${totalNotes}`));
    console.log('');
    console.log(chalk.white('📈 优先级分布:'));
    console.log(chalk.red(`  🔴 高优先级: ${priorityStats.high || 0}`));
    console.log(chalk.yellow(`  🟡 中优先级: ${priorityStats.medium || 0}`));
    console.log(chalk.green(`  🟢 低优先级: ${priorityStats.low || 0}`));
    console.log('');
    console.log(chalk.white(`📏 平均内容长度: ${avgContentLength} 字符`));
    console.log('');
    console.log(chalk.white('🕐 最近创建的笔记:'));
    sortedByDate.slice(0, 3).forEach((note, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${note.title}`));
    });
  }
  
  await waitForContinue();
}

/**
 * 等待用户继续
 */
async function waitForContinue() {
  console.log('');
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: '按 Enter 键继续...'
    }
  ]);
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log(chalk.cyan('🚀 启动简易记事本...'));
    
    while (true) {
      const action = await showMainMenu();
      
      switch (action) {
        case 'create':
          await createNote();
          break;
        case 'list':
          await listNotes();
          break;
        case 'search':
          await searchNotes();
          break;
        case 'edit':
          await editNote();
          break;
        case 'delete':
          await deleteNote();
          break;
        case 'stats':
          await showStats();
          break;
        case 'exit':
          console.clear();
          console.log(chalk.cyan('👋 感谢使用简易记事本!'));
          process.exit(0);
      }
    }
  } catch (error) {
    console.error(chalk.red('程序发生错误:'), error.message);
    console.log(chalk.yellow('程序将在 5 秒后退出...'));
    setTimeout(() => process.exit(1), 5000);
  }
}

// 启动应用
if (require.main === module) {
  main();
}

module.exports = {
  readNotes,
  saveNotes,
  createNote,
  listNotes,
  searchNotes,
  editNote,
  deleteNote,
  showStats
};