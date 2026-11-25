import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { blank, clock, duration, parseRange, shift } from './model.js';
import { read, save } from './storage.js';
registerSW({ immediate: true });
const editor = document.querySelector('#editor');
const status = document.querySelector('#status');
let rows = [{ ...blank(), startPending: true, startDraft: '' }];
let selected = null;
let active = { index: 0, kind: 'time' };
let composing = false;
function lockCaret() {
  if (composing) return;
  const el = editor.children[active.index]?.querySelector(`.${active.kind}`);
  if (!el || document.activeElement !== el) return;
  const start = selected ? (active.kind === 'time' ? 6 : 0) : el.value.length;
  if (el.selectionStart !== start || el.selectionEnd !== el.value.length) {
    el.setSelectionRange(start, el.value.length);
  }
}
function resume() { focus(active.index, active.kind, Boolean(selected)); }
function error() { status.hidden = false; status.textContent = '로컬 저장을 사용할 수 없습니다. 내용을 복사해 보관해 주세요.'; }
try { rows = await read() || rows; } catch { error(); }
if (rows[0].startPending) active = { index: 0, kind: 'start' };
function persist() { save(rows).catch(error); }
function focus(index, kind, select = false) {
  active = { index, kind };
  selected = select ? {index, kind} : null;
  const el = editor.children[index].querySelector(`.${kind}`);
  el.focus();
  el.setSelectionRange(select ? (kind === 'time' ? 6 : 0) : el.value.length, el.value.length);
}
function refreshTimes() {
  rows.forEach((row, i) => {
    editor.children[i].querySelector('.time').value = `${clock(row.start)}-${clock(row.start + row.minutes)}`;
    editor.children[i].querySelector('.duration').textContent = `(${duration(row.minutes)})`;
  });
}
function removeAbandonedRows() {
  while (rows.length > active.index + 1) {
    const last = rows.at(-1);
    if (last.minutes !== 0 || last.task !== '') break;
    rows.pop();
    editor.lastElementChild.remove();
  }
}
function action(index, kind, key) {
  const row = rows[index];
  if (key === 'Enter') {
    if (kind === 'time') focus(index, 'task');
    else {
      if (!rows[index + 1]) { rows.push(blank((row.start + row.minutes) % 1440)); render(); }
      focus(index + 1, 'time');
    }
  } else if (kind === 'time' && key === ' ') {
    shift(rows, index, 10); refreshTimes(); focus(index, 'time');
  } else if (key === 'Backspace') {
    if (selected?.index === index && selected.kind === kind) {
      if (kind === 'time') { shift(rows, index, -row.minutes); refreshTimes(); focus(index, 'time'); }
      else { row.task = ''; editor.children[index].querySelector('.task').value = ''; resize(editor.children[index].querySelector('.task')); focus(index, 'task'); }
    } else if (kind === 'time') {
      if (row.minutes) { shift(rows, index, -10); refreshTimes(); focus(index, 'time'); }
      else if (index > 0) focus(index - 1, 'task', true);
      else {
        row.startPending = true;
        row.startDraft = clock(row.start).replace(':', '');
        render(); focus(0, 'start');
      }
    } else if (!row.task) focus(index, 'time', true);
    else return false;
  } else return false;
  removeAbandonedRows();
  persist(); return true;
}
function resize(el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
function render() {
  editor.replaceChildren();
  if (rows[0].startPending) {
    const line = document.createElement('div'); line.className = 'row';
    const input = document.createElement('input'); input.className = 'start';
    input.type = 'text'; input.inputMode = 'numeric'; input.enterKeyHint = 'next';
    input.placeholder = '00:00'; input.value = rows[0].startDraft || '';
    input.setAttribute('aria-label', '최초 시작 시각 (HH:MM 또는 HHMM)');
    input.autocomplete = 'off'; input.tabIndex = -1;
    const confirm = () => {
      const value = input.value.trim();
      const match = /^(\d{1,2}):(\d{2})$/.exec(value) || /^(\d{2})(\d{2})$/.exec(value);
      const hour = match ? Number(match[1]) : 0;
      const minute = match ? Number(match[2]) : 0;
      if ((value && !match) || hour > 23 || minute > 59) {
        input.setCustomValidity('00:00~23:59 사이의 시각을 HH:MM 또는 HHMM으로 입력해 주세요.');
        input.reportValidity(); return;
      }
      rows[0].start = hour * 60 + minute;
      shift(rows, 0, 0);
      rows[0].startPending = false;
      delete rows[0].startDraft;
      render(); focus(0, 'time'); persist();
    };
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); confirm(); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'].includes(event.key) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) event.preventDefault();
    });
    input.addEventListener('beforeinput', event => {
      if (['insertLineBreak', 'insertParagraph'].includes(event.inputType)) { event.preventDefault(); confirm(); }
      else lockCaret();
    });
    input.addEventListener('input', () => {
      input.setCustomValidity(''); rows[0].startDraft = input.value; persist();
      if (/^\d{4}$/.test(input.value)) confirm();
    });
    line.append(input); editor.append(line);
    return;
  }
  rows.forEach((row, index) => {
    const line = document.createElement('div'); line.className = 'row';
    const time = document.createElement('input'); time.className = 'time'; time.type = 'text';
    time.setAttribute('aria-label', `${index + 1}번째 시작 및 종료 시각`);
    time.spellcheck = false; time.autocomplete = 'off';
    const elapsed = document.createElement('span'); elapsed.className = 'duration';
    const task = document.createElement('textarea'); task.className = 'task'; task.rows = 1; task.value = row.task;
    task.setAttribute('aria-label', `${index + 1}번째 할 일`);
    for (const [el, kind] of [[time, 'time'], [task, 'task']]) {
      el.tabIndex = -1;
      el.addEventListener('focus', () => {
        if (active.index !== index || active.kind !== kind) resume();
      });
      el.addEventListener('compositionstart', () => { composing = true; });
      el.addEventListener('compositionend', () => { composing = false; lockCaret(); });
      el.addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'].includes(event.key) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) {
          event.preventDefault(); return;
        }
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        lockCaret();
        if (action(index, kind, event.key)) event.preventDefault();
      });
      el.addEventListener('beforeinput', event => {
        if (event.isComposing) return;
        lockCaret();
        const key = event.inputType === 'deleteContentBackward' ? 'Backspace' : ['insertLineBreak', 'insertParagraph'].includes(event.inputType) ? 'Enter' : event.inputType === 'insertText' && event.data === ' ' ? ' ' : null;
        if (key && action(index, kind, key)) event.preventDefault();
      });
    }
    time.addEventListener('input', () => {
      selected = null;
      const parsed = parseRange(time.value);
      if (parsed) { Object.assign(row, parsed); shift(rows, index, 0); refreshTimes(); persist(); }
    });
    time.addEventListener('blur', refreshTimes);
    task.addEventListener('input', () => { selected = null; row.task = task.value; resize(task); persist(); });
    line.append(time, elapsed, task); editor.append(line); resize(task);
  });
  refreshTimes();
}
render();
const clearButton = document.createElement('button');
clearButton.type = 'button';
clearButton.className = 'clear';
clearButton.textContent = '전체 삭제';
const copyButton = document.createElement('button');
copyButton.type = 'button';
copyButton.className = 'copy';
copyButton.textContent = '전체 복사';
const actions = document.createElement('div');
actions.className = 'actions';
actions.append(copyButton, clearButton);
editor.after(actions);
copyButton.addEventListener('click', async () => {
  const text = rows[0].startPending
    ? rows[0].startDraft || ''
    : rows.map(row => `${clock(row.start)}-${clock(row.start + row.minutes)} (${duration(row.minutes)})${row.task ? ` ${row.task}` : ''}`).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = '복사 완료';
    setTimeout(() => { copyButton.textContent = '전체 복사'; }, 1500);
  } catch {
    window.alert('복사하지 못했습니다. 클립보드 권한을 확인해 주세요.');
  }
});
clearButton.addEventListener('click', () => {
  if (!window.confirm('저장된 일정을 모두 삭제할까요?')) return;
  rows = [{ ...blank(), startPending: true, startDraft: '' }];
  selected = null;
  composing = false;
  active = { index: 0, kind: 'start' };
  render(); focus(0, 'start'); persist();
});
document.addEventListener('selectionchange', lockCaret);
document.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.pointerType === 'mouse') event.preventDefault();
  resume();
});
document.addEventListener('click', event => {
  if (event.target.closest('button')) return;
  event.preventDefault(); resume();
});
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });
for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(name, event => event.preventDefault(), { passive: false });
}
document.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey) event.preventDefault();
}, { passive: false });
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) event.preventDefault();
});
window.addEventListener('resize', () => editor.querySelectorAll('.task').forEach(resize));
