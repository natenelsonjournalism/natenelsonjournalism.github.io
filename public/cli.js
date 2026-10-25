// The homepage's typed-command box. Everything it shows is already on the page: the
// script only compares what the visitor typed against the fixed list below and, on a
// match, jumps to that section (#stories, #about, ...), exactly as clicking the command
// does. What the visitor types is never shown, stored, sent anywhere or run.
// Without this script the page still works: every command is a link.
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
    // A few aliases people may try.
    journalism: 'stories',
    whoami: 'about',
    ls: 'help',
    '?': 'help',
  };
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

  const history = [];
  let back = 0;

  const run = (raw) => {
    const typed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (typed === '') return;
    history.push(typed);
    back = 0;

    if (typed === 'clear') {
      location.hash = '';
      window.scrollTo(0, 0);
      say('Cleared.');
      return;
    }
    if (typed === 'sudo' || typed.startsWith('sudo ')) {
      say('sudo: permission denied. Nice try.', true);
      return;
    }
    const id = Object.prototype.hasOwnProperty.call(COMMANDS, typed) ? COMMANDS[typed] : null;
    if (!id) {
      say('command not found. Type "help" to see the commands.', true);
      return;
    }
    if (location.hash === '#' + id) {
      // Already showing it: just bring it back into view.
      const target = document.getElementById(id);
      if (target) target.scrollIntoView();
    } else {
      location.hash = id;
    }
    say(id === 'help' ? 'Showing the list of commands.' : 'Showing ' + id + '.');
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
