// The homepage's typed-command box. Everything it shows is already on the page: the
// script only compares what the visitor typed against the fixed list below and, on a
// match, jumps to that section (#stories, #about, ...), exactly as clicking the command
// does with scripts off. What the visitor types is never shown, stored, sent anywhere or
// run. Without this script the page still works: every command is then a link.
// Rules this file must keep are checked by scripts/verify-build.mjs (see CLAUDE.md).

'use strict';

(() => {
  // Typed command → section id. Only these exact strings do anything (in any mix of
  // capitals: WHOAMI and Whoami work too).
  const COMMANDS = {
    whoami: 'about',
    news: 'stories',
    pod: 'podcasts',
    proj: 'projects',
    tips: 'contact',
    ping: 'contact', // its old name
    help: 'help',
    ls: 'help', // what people try in a real terminal
  };
  // Easter egg: anything that looks like an attempt to inject code (HTML, script, SQL,
  // shell), or sudo. It couldn't work anyway (the text is only ever compared, never run
  // or shown), so it just gets a fixed reply.
  const ATTACK =
    /[<>{}`;|&$\\]|\.\.\/|%[0-9a-f]{2}|script|alert\s*\(|javascript:|\bunion\s+select\b|\bdrop\s+table\b|\bselect\s.*\bfrom\b|'\s*or\s|\bor\s+1\s*=\s*1\b|\brm\s+-|\/etc\/passwd|\bchmod\b|\bcurl\b|\bwget\b|^sudo\b/;

  // Suggested by Tab completion, in this order.
  const MAIN = ['whoami', 'news', 'pod', 'proj', 'tips', 'help', 'clear'];

  const form = document.getElementById('cli-form');
  const input = document.getElementById('cli-input');
  const status = document.getElementById('cli-status');
  const caret = document.querySelector('.cli-caret');
  const ghost = document.querySelector('.cli-ghost');
  if (!form || !input || !status || !caret || !ghost) return;

  document.documentElement.classList.add('js');
  form.hidden = false;

  // Fixed messages only; never the visitor's text. A "quiet" message is for screen
  // readers only: like a real terminal, a command that works says nothing on screen.
  const say = (message, tone) => {
    status.textContent = message;
    status.classList.toggle('cli-error', tone === 'error');
    status.classList.toggle('cli-quiet', tone === 'quiet');
  };

  // How many typos apart two words are (a missing, extra or wrong letter, or two letters
  // swapped), to catch things like "whaomi" or "nwes".
  const distance = (a, b) => {
    let prev = [];
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) {
        next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          next[j] = Math.min(next[j], prev[j - 2] + 1);
        }
      }
      prev = row;
      row = next;
    }
    return row[b.length];
  };

  const history = [];
  let back = 0;

  const run = (raw) => {
    const typed = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (typed === '') return false;
    history.push(typed);
    back = 0;
    stopHint();

    if (ATTACK.test(typed)) {
      say('Nice try, sucka!!', 'error');
      return false;
    }
    if (typed === 'clear') {
      location.hash = '';
      window.scrollTo(0, 0);
      say('Cleared.', 'quiet');
      return true;
    }
    const id = Object.prototype.hasOwnProperty.call(COMMANDS, typed) ? COMMANDS[typed] : null;
    if (!id) {
      // Suggest the closest command (one of ours, never the visitor's text).
      // Short commands allow one wrong letter, longer ones two.
      const near = typed.length >= 3 ? MAIN.find((c) => distance(typed, c) <= (c.length <= 4 ? 1 : 2)) : undefined;
      say(
        near
          ? 'command not found. Did you mean "' + near + '"?'
          : 'command not found. Type "help" to see the commands.',
        'error',
      );
      return false;
    }
    if (location.hash !== '#' + id) location.hash = id;
    reveal(id);
    say(id === 'help' ? 'Showing the list of commands.' : 'Showing ' + id + '.', 'quiet');
    return true;
  };

  const touch = !window.matchMedia('(pointer: fine)').matches;

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
    const ran = run(input.value);
    input.value = '';
    // On phones, a command that works puts the keyboard away so its output can be read;
    // after an error it stays up for another try.
    if (ran && touch) input.blur();
    else input.focus({ preventScroll: true });
  });

  // The one command that starts with what's typed, if exactly one does (for Tab, the
  // right arrow and the grey suggestion).
  const completion = () => {
    const start = input.value.trim().toLowerCase();
    if (start === '') return null;
    const matches = MAIN.filter((c) => c.startsWith(start));
    return matches.length === 1 && matches[0] !== start ? matches[0] : null;
  };

  // "try: whoami" in grey after the cursor, if nothing has been typed for 10 seconds.
  // Shown at most once, and gone for good once the visitor types or runs a command.
  let hint = false;
  const hintTimer = setTimeout(() => {
    hint = input.value === '';
    placeCaret();
  }, 10000);
  const stopHint = () => {
    clearTimeout(hintTimer);
    hint = false;
  };

  // Grey text after the cursor, as in the fish shell: the rest of the command that fits
  // (always one of ours, never the visitor's text), or the hint. Placed like the cursor.
  const suggest = () => {
    const end = input.value.length;
    const match = (input.selectionStart ?? end) === end ? completion() : null;
    if (match) {
      // The cursor sits on the suggestion's first letter and shows it in reverse, as a
      // terminal's block cursor does; the grey text carries on after it.
      const rest = match.slice(input.value.trim().length);
      caret.dataset.char = rest[0];
      ghost.textContent = rest.slice(1);
      ghost.style.setProperty('--ghost-at', String(end + 1));
      return;
    }
    delete caret.dataset.char;
    if (hint && end === 0) {
      ghost.textContent = 'try: whoami';
      ghost.style.setProperty('--ghost-at', '2');
    } else {
      ghost.textContent = '';
    }
  };

  // A terminal-style block cursor, drawn over the (hidden) browser caret. It sits one
  // character-width per letter along, since the font is monospace.
  const placeCaret = () => {
    const at = input.selectionStart ?? input.value.length;
    caret.style.setProperty('--at', String(at));
    form.style.setProperty('--scroll', input.scrollLeft + 'px');
    suggest();
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

  input.addEventListener('input', stopHint);

  input.addEventListener('keydown', (event) => {
    // Right arrow at the end of the line accepts the grey suggestion, as in fish.
    if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) {
      const match = completion();
      if (match) {
        event.preventDefault();
        input.value = match;
        placeCaret();
        return;
      }
    }
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
      const match = completion();
      if (match) {
        event.preventDefault();
        input.value = match;
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
  if (!touch && !location.hash) {
    input.focus({ preventScroll: true });
  }
})();
