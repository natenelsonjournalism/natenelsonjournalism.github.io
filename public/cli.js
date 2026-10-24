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
  if (!form || !input || !status) return;

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
      say('Permission denied. Nice try.', true);
      return;
    }
    const id = Object.prototype.hasOwnProperty.call(COMMANDS, typed) ? COMMANDS[typed] : null;
    if (!id) {
      say('Command not found. Type "help" to see the commands.', true);
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

  input.addEventListener('keydown', (event) => {
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
      }
    }
  });

  // Ready to type on computers; on phones, wait for a tap so the keyboard doesn't pop up.
  if (window.matchMedia('(pointer: fine)').matches && !location.hash) {
    input.focus({ preventScroll: true });
  }
})();
