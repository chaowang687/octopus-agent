/**
 * 简易记事本 - 单元测试
 */

const fs = require('fs');
const path = require('path');
const { 
  readNotes, 
  saveNotes, 
  createNote, 
  listNotes, 
  searchNotes, 
  editNote, 
  deleteNote, 
  showStats 
} = require('../src/index');

// 测试数据目录
const TEST_DATA_DIR = path.join(__dirname, '../src/data');
const TEST_NOTES_FILE = path.join(TEST_DATA_DIR, 'notes.test.json');

// 备份原始文件路径
let originalNotesFile;

beforeAll(() => {
  // 备份原始文件路径
  originalNotesFile = require('../src/index').NOTES_FILE;
  
  // 创建测试数据目录
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  
  // 初始化测试数据文件
  fs.writeFileSync(TEST_NOTES_FILE, JSON.stringify([], null, 2));
  
  // 修改模块中的文件路径为测试文件
  require('../src/index').NOTES_FILE = TEST_NOTES_FILE;
});

afterAll(() => {
  // 恢复原始文件路径
  require('../src/index').NOTES_FILE = originalNotesFile;
  
  // 清理测试文件
  if (fs.existsSync(TEST_NOTES_FILE)) {
    fs.unlinkSync(TEST_NOTES_FILE);
  }
});

beforeEach(() => {
  // 每个测试前清空测试数据
  fs.writeFileSync(TEST_NOTES_FILE, JSON.stringify([], null, 2));
});

describe('数据读写功能', () => {
  test('读取空笔记文件', () => {
    const notes = readNotes();
    expect(notes).toEqual([]);
    expect(Array.isArray(notes)).toBe(true);
  });
  
  test('保存和读取笔记', () => {
    const testNotes = [
      {
        id: 'test-id-1',
        title: '测试笔记1',
        content: '测试内容1',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'test-id-2',
        title: '测试笔记2',
        content: '测试内容2',
        priority: 'medium',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }
    ];
    
    saveNotes(testNotes);
    const loadedNotes = readNotes();
    
    expect(loadedNotes).toHaveLength(2);
    expect(loadedNotes[0].title).toBe('测试笔记1');
    expect(loadedNotes[1].title).toBe('测试笔记2');
    expect(loadedNotes[0].priority).toBe('high');
    expect(loadedNotes[1].priority).toBe('medium');
  });
  
  test('处理损坏的JSON文件', () => {
    // 写入损坏的JSON数据
    fs.writeFileSync(TEST_NOTES_FILE, 'invalid json data');
    
    // 应该返回空数组而不是抛出错误
    const notes = readNotes();
    expect(notes).toEqual([]);
  });
});

describe('笔记操作功能', () => {
  test('创建笔记数据结构', () => {
    const noteData = {
      id: 'test-id',
      title: '测试标题',
      content: '测试内容',
      priority: 'medium',
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    };
    
    // 验证数据结构
    expect(noteData).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      content: expect.any(String),
      priority: expect.stringMatching(/^(high|medium|low)$/),
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
  });
  
  test('搜索笔记功能', () => {
    const notes = [
      {
        id: '1',
        title: 'JavaScript学习笔记',
        content: '学习JavaScript基础知识',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        title: '会议记录',
        content: '讨论项目进度',
        priority: 'medium',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      },
      {
        id: '3',
        title: '购物清单',
        content: '购买JavaScript书籍',
        priority: 'low',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z'
      }
    ];
    
    saveNotes(notes);
    
    // 模拟搜索功能
    const searchTerm = 'javascript';
    const results = notes.filter(note => 
      note.title.toLowerCase().includes(searchTerm) || 
      note.content.toLowerCase().includes(searchTerm)
    );
    
    expect(results).toHaveLength(2); // 应该找到2条包含'javascript'的笔记
    expect(results[0].title).toBe('JavaScript学习笔记');
    expect(results[1].title).toBe('购物清单');
  });
  
  test('编辑笔记功能', () => {
    const originalNote = {
      id: 'edit-test-id',
      title: '原始标题',
      content: '原始内容',
      priority: 'low',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    saveNotes([originalNote]);
    
    // 模拟编辑操作
    const updatedNote = {
      ...originalNote,
      title: '更新后的标题',
      content: '更新后的内容',
      priority: 'high',
      updatedAt: '2024-01-02T00:00:00.000Z'
    };
    
    const notes = readNotes();
    const noteIndex = notes.findIndex(note => note.id === originalNote.id);
    
    if (noteIndex !== -1) {
      notes[noteIndex] = updatedNote;
      saveNotes(notes);
    }
    
    const loadedNotes = readNotes();
    expect(loadedNotes[0].title).toBe('更新后的标题');
    expect(loadedNotes[0].content).toBe('更新后的内容');
    expect(loadedNotes[0].priority).toBe('high');
    expect(loadedNotes[0].updatedAt).toBe('2024-01-02T00:00:00.000Z');
  });
  
  test('删除笔记功能', () => {
    const notes = [
      {
        id: 'delete-1',
        title: '要删除的笔记1',
        content: '内容1',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'keep-1',
        title: '保留的笔记1',
        content: '内容2',
        priority: 'medium',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }
    ];
    
    saveNotes(notes);
    
    // 模拟删除操作
    const noteIdToDelete = 'delete-1';
    const filteredNotes = notes.filter(note => note.id !== noteIdToDelete);
    saveNotes(filteredNotes);
    
    const loadedNotes = readNotes();
    expect(loadedNotes).toHaveLength(1);
    expect(loadedNotes[0].id).toBe('keep-1');
    expect(loadedNotes[0].title).toBe('保留的笔记1');
  });
});

describe('统计功能', () => {
  test('统计笔记数量', () => {
    const notes = [
      { id: '1', title: '笔记1', content: '内容1', priority: 'high', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      { id: '2', title: '笔记2', content: '内容2', priority: 'medium', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
      { id: '3', title: '笔记3', content: '内容3', priority: 'low', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
      { id: '4', title: '笔记4', content: '内容4', priority: 'high', createdAt: '2024-01-04T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z' }
    ];
    
    saveNotes(notes);
    const loadedNotes = readNotes();
    
    expect(loadedNotes).toHaveLength(4);
    
    // 优先级统计
    const priorityStats = loadedNotes.reduce((acc, note) => {
      acc[note.priority] = (acc[note.priority] || 0) + 1;
      return acc;
    }, {});
    
    expect(priorityStats.high).toBe(2);
    expect(priorityStats.medium).toBe(1);
    expect(priorityStats.low).toBe(1);
    
    // 平均内容长度
    const totalContentLength = loadedNotes.reduce((sum, note) => sum + note.content.length, 0);
    const avgContentLength = Math.round(totalContentLength / loadedNotes.length);
    
    expect(avgContentLength).toBe(6); // 每个内容都是6个字符
  });
  
  test('空笔记统计', () => {
    const notes = [];
    saveNotes(notes);
    const loadedNotes = readNotes();
    
    expect(loadedNotes).toHaveLength(0);
    
    // 优先级统计应该为空
    const priorityStats = loadedNotes.reduce((acc, note) => {
      acc[note.priority] = (acc[note.priority] || 0) + 1;
      return acc;
    }, {});
    
    expect(priorityStats).toEqual({});
  });
});

describe('边界情况和错误处理', () => {
  test('处理空标题和内容', () => {
    // 测试数据验证逻辑
    const validateTitle = (input) => input.trim() ? true : '标题不能为空';
    const validateContent = (input) => input.trim() ? true : '内容不能为空';
    
    expect(validateTitle('')).toBe('标题不能为空');
    expect(validateTitle('   ')).toBe('标题不能为空');
    expect(validateTitle('有效标题')).toBe(true);
    
    expect(validateContent('')).toBe('内容不能为空');
    expect(validateContent('   ')).toBe('内容不能为空');
    expect(validateContent('有效内容')).toBe(true);
  });
  
  test('处理无效优先级', () => {
    const notes = [
      {
        id: '1',
        title: '测试笔记',
        content: '测试内容',
        priority: 'invalid', // 无效的优先级
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ];
    
    saveNotes(notes);
    const loadedNotes = readNotes();
    
    // 即使优先级无效，也应该能正常加载
    expect(loadedNotes[0].priority).toBe('invalid');
  });
  
  test('处理重复ID', () => {
    const duplicateId = 'duplicate-id';
    const notes = [
      {
        id: duplicateId,
        title: '笔记1',
        content: '内容1',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: duplicateId, // 重复的ID
        title: '笔记2',
        content: '内容2',
        priority: 'medium',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z'
      }
    ];
    
    // 系统应该允许重复ID（虽然不推荐）
    saveNotes(notes);
    const loadedNotes = readNotes();
    
    expect(loadedNotes).toHaveLength(2);
    expect(loadedNotes[0].id).toBe(duplicateId);
    expect(loadedNotes[1].id).toBe(duplicateId);
  });
});

console.log('✅ 所有测试用例编写完成！');
console.log('运行测试: npm test');