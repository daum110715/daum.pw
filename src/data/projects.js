// 项目数据(来自旧站,真实)。cat 用于筛选:active / done / pending
export const projects = [
  { num: '01', name: '清雨 tpor 档案馆', desc: 'B 站主播争议事件 · 静态归档站点', url: 'https://清雨tpor.wtf', status: '进行中', cat: 'active' },
  { num: '02', name: 'MBTI 测试', desc: '人格类型测试小站', url: 'https://mbti.daum.pw', status: '开发完成', cat: 'done' },
  { num: '03', name: '七七百科站', desc: '原神相关资料站', url: 'https://qiqi.help', status: '开发中', cat: 'active' },
  { num: '04', name: 'Chatbox', desc: 'AI 虚拟聊天工具', url: 'https://chatbox.daum.pw', status: 'Beta 测试中', cat: 'active' },
  { num: '05', name: 'ds-review-agent', desc: 'AI 审查违规内容工具', url: 'https://dsrevagent.daum.pw', status: 'Beta 测试中', cat: 'active' },
  { num: '06', name: '短链服务', desc: 'link.ijk.cam', url: 'https://link.ijk.cam', status: '已上线', cat: 'done' },
  { num: '07', name: 'Encrypt & Decrypt', desc: '加解密工具', url: 'https://ed.daum.pw', status: '已完成', cat: 'done' },
  { num: '08', name: 'BSC Trading Viewer', desc: 'BNB Chain 交易查看工具', url: 'https://bsc.daum.pw', status: '已完成', cat: 'done' },
  { num: '09', name: 'Solana Trading Viewer', desc: 'Solana 链交易查看工具', url: 'https://sol.daum.pw', status: '已完成', cat: 'done' },
  { num: '10', name: 'RIP²', desc: 'B 站守墓人记录页', url: 'https://rip2.daum.pw', status: '已完成', cat: 'done' },
  { num: '11', name: 'wei 某人的小站', desc: '代管中', url: 'https://weiwei.uno', status: '开发中', cat: 'active' },
  { num: '12', name: 'Stone Rip', desc: '某位小可爱的赛博墓碑', url: 'https://stonerip.icu', status: '待定', cat: 'pending', off: true },
]

// 筛选项(cat)
export const projectFilters = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'pending', label: '待定' },
]
