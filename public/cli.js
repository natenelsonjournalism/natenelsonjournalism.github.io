// The homepage's typed-command box. Everything it shows is already on the page: the
// script only compares what the visitor typed against the fixed list below and, on a
// match, jumps to that section (#stories, #about, ...), exactly as clicking the command
// does with scripts off. What the visitor types is never shown, stored, sent anywhere or
// run. Without this script the page still works: every command is then a link.
// Rules this file must keep are checked by scripts/verify-build.mjs (see CLAUDE.md).

'use strict';

(() => {
  // Typed command → section id. Only these exact strings do anything.
  const COMMANDS = {
    stories: 'stories',
    podcasts: 'podcasts',
    projects: 'projects',
    about: 'about',
    contact: 'contact',
    help: 'help',
    // Two-letter forms, shown on touch screens where typos are easy.
    st: 'stories',
    po: 'podcasts',
    pr: 'projects',
    ab: 'about',
    co: 'contact',
    // A few aliases people may try.
    journalism: 'stories',
    whoami: 'about',
    ls: 'help',
    '?': 'help',
  };
  // Easter egg: anything that looks like an attempt to inject code (HTML, script, SQL,
  // shell), or sudo. It couldn't work anyway (the text is only ever compared, never run
  // or shown), so it just gets a fixed reply.
  const ATTACK =
    /[<>{}`;|&$\\]|\.\.\/|%[0-9a-f]{2}|script|alert\s*\(|javascript:|\bunion\s+select\b|\bdrop\s+table\b|\bselect\s.*\bfrom\b|'\s*or\s|\bor\s+1\s*=\s*1\b|\brm\s+-|\/etc\/passwd|\bchmod\b|\bcurl\b|\bwget\b|^sudo\b/;

  // Suggested by Tab completion, in this order.
  const MAIN = ['stories', 'podcasts', 'projects', 'about', 'contact', 'help', 'clear'];

  const form = document.getElementById('cli-form');
  const input = document.getElementById('cli-input');
  const status = document.getElementById('cli-status');
  const caret = document.querySelector('.cli-caret');
  if (!form || !input || !status || !caret) return;

  document.documentElement.classList.add('js');
  form.hidden = false;

  // Fixed messages only; never the visitor's text.
  const say = (message, isError) => {
    status.textContent = message;
    status.classList.toggle('cli-error', Boolean(isError));
  };

  // Letters that differ between two words (edit distance), to catch typos like "storeis".
  const distance = (a, b) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) {
        next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      row = next;
    }
    return row[b.length];
  };

  const history = [];
  let back = 0;

  const run = (raw) => {
    const typed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (typed === '') return;
    history.push(typed);
    back = 0;

    if (ATTACK.test(typed)) {
      say('Nice try, sucka!!', true);
      return;
    }
    if (typed === 'clear') {
      location.hash = '';
      window.scrollTo(0, 0);
      say('Cleared.');
      return;
    }
    const id = Object.prototype.hasOwnProperty.call(COMMANDS, typed) ? COMMANDS[typed] : null;
    if (!id) {
      // Suggest the closest command (one of ours, never the visitor's text).
      const near = typed.length >= 3 ? MAIN.find((c) => distance(typed, c) <= 2) : undefined;
      say(
        near
          ? 'command not found. Did you mean "' + near + '"?'
          : 'command not found. Type "help" to see the commands.',
        true,
      );
      return;
    }
    if (location.hash !== '#' + id) location.hash = id;
    reveal(id);
    say(id === 'help' ? 'Showing the list of commands.' : 'Showing ' + id + '.');
  };

  // Scroll like a terminal: just far enough to show the new output and the prompt under
  // it, keeping what's above in view when it all fits. (Going to a #link would instead
  // put the output at the top of the screen.)
  const reveal = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY;
    const bottom = form.getBoundingClientRect().bottom + window.scrollY + 48;
    window.scrollTo(0, Math.max(0, Math.min(top, bottom - window.innerHeight)));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run(input.value);
    input.value = '';
    input.focus({ preventScroll: true });
  });

  // A terminal-style block cursor, drawn over the (hidden) browser caret. It sits one
  // character-width per letter along, since the font is monospace.
  const placeCaret = () => {
    const at = input.selectionStart ?? input.value.length;
    caret.style.setProperty('--at', String(at));
    caret.style.setProperty('--scroll', input.scrollLeft + 'px');
    // Restart the blink after each keystroke, as terminals do (it blinks five times, then holds).
    caret.classList.remove('blink');
    void caret.offsetWidth;
    caret.classList.add('blink');
  };
  for (const name of ['input', 'keyup', 'click', 'focus', 'select']) input.addEventListener(name, placeCaret);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) placeCaret();
  });
  form.classList.add('has-caret');

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      placeCaret();
      return;
    }
    // Up/Down: previous commands, like a real shell.
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (history.length === 0) return;
      event.preventDefault();
      back = Math.max(0, Math.min(history.length, back + (event.key === 'ArrowUp' ? 1 : -1)));
      input.value = back === 0 ? '' : history[history.length - back];
      return;
    }
    // Tab completes a command when exactly one fits; otherwise Tab moves focus as usual.
    if (event.key === 'Tab' && !event.shiftKey && input.value !== '') {
      const start = input.value.trim().toLowerCase();
      const matches = MAIN.filter((c) => c.startsWith(start));
      if (matches.length === 1 && matches[0] !== start) {
        event.preventDefault();
        input.value = matches[0];
        placeCaret();
      } else if (matches.length > 1) {
        // Like a shell: list what could come next.
        event.preventDefault();
        say(matches.join('   '));
      }
    }
  });

  // Start typing anywhere on the page and it goes into the command box (not while using
  // a link, the audio players or a key combination).
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 || event.key === ' ') return;
    const active = document.activeElement;
    if (active === input || (active && active.matches('input, textarea, select, audio, [contenteditable]'))) return;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: 'nearest' });
  });

  // Ready to type on computers; on phones, wait for a tap so the keyboard doesn't pop up.
  if (window.matchMedia('(pointer: fine)').matches && !location.hash) {
    input.focus({ preventScroll: true });
  }
})();
