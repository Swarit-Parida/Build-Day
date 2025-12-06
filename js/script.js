(() => {
  const SOUND_MAP = {
    "voicy-ben10-intro": "sounds/voicy-ben10-intro.mp3",
    "voicy-humungousaur": "sounds/voicy-humungousaur.mp3",
    "voicy-pikachu": "sounds/voicy-pikachu.mp3",
    "voicy-squirtle": "sounds/voicy-squirtle.mp3",
    "voicy-swamp-fire": "sounds/voicy-swamp-fire.mp3",
    "dinamaxxx": "sounds/dinamaxxx.mp3"
  };

  const buttons = Array.from(document.querySelectorAll('.sound-btn'));
  const volumeSlider = document.getElementById('volume');
  const muteBtn = document.getElementById('muteBtn');
  const themeToggle = document.getElementById('themeToggle');
  const app = document.querySelector('.app');

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;

  const baseAudio = {};
  Object.entries(SOUND_MAP).forEach(([id, path]) => {
    const a = new Audio(path);
    a.crossOrigin = "anonymous";
    a.preload = 'auto';
    a.loop = false;
    a.volume = Number(volumeSlider.value);
    baseAudio[id] = a;
  });

  let isMuted = false;

  function playSound(id, buttonEl) {
    const template = baseAudio[id];
    if (!template) return;
    const audio = template.cloneNode(true);
    audio.volume = isMuted ? 0 : Number(volumeSlider.value);

    buttonEl.classList.add('playing');
    setTimeout(() => buttonEl.classList.remove('playing'), 700);

    if (audioCtx) {
      const source = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      startVisualizer(buttonEl.querySelector('.vis'), analyser);
    }

    audio.play().catch(e => {
      console.warn("Playback blocked", e);
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => audio.play().catch(()=>{}));
      }
    });

    audio.addEventListener('ended', () => {
      clearCanvas(buttonEl.querySelector('.vis'));
    });

    return audio;
  }

  const visMap = new WeakMap();
  function startVisualizer(canvas, analyser) {
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    const h = canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    function draw() {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0,0,w,h);

      const barWidth = (w / bufferLength) * 1.2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 255;
        const barHeight = v * h;
        const theme = app.getAttribute('data-theme');
        let grad;
        if (theme === 'arena') {
          grad = ctx.createLinearGradient(0,0,0,h);
          grad.addColorStop(0, 'rgba(255,215,102,0.95)');
          grad.addColorStop(1, 'rgba(255,123,123,0.6)');
        } else {
          grad = ctx.createLinearGradient(0,0,0,h);
          grad.addColorStop(0, 'rgba(126,249,162,0.95)');
          grad.addColorStop(1, 'rgba(107,231,255,0.6)');
        }

        ctx.fillStyle = grad;
        const barX = x;
        const barY = h - barHeight;
        const radius = 4 * (window.devicePixelRatio || 1);
        roundRect(ctx, barX, barY, barWidth, barHeight, radius);
        ctx.fill();
        x += barWidth + 2;
      }
      const rafId = requestAnimationFrame(draw);
      visMap.set(canvas, { rafId, analyser });
    }

    const current = visMap.get(canvas);
    if (current && current.rafId) cancelAnimationFrame(current.rafId);

    draw();
  }

  function clearCanvas(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cur = visMap.get(canvas);
    if (cur && cur.rafId) {
      cancelAnimationFrame(cur.rafId);
      visMap.delete(canvas);
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, height/2, width/2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  buttons.forEach(btn => {
    const soundId = btn.dataset.sound;
    btn.addEventListener('click', (e) => {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      playSound(soundId, btn);
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.code === 'Space') btn.click();
    });
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const key = ev.key;
    if (key === 'm' || key === 'M') {
      toggleMute();
      return;
    }
    if (/^[1-6]$/.test(key)) {
      const btn = document.querySelector(`.sound-btn[data-key="${key}"]`);
      if (btn) {
        btn.classList.add('playing');
        setTimeout(() => btn.classList.remove('playing'), 700);
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        playSound(btn.dataset.sound, btn);
      }
    }
  });

  volumeSlider.addEventListener('input', () => {
    const v = Number(volumeSlider.value);
    Object.values(baseAudio).forEach(a => a.volume = v);
  });

  function toggleMute() {
    isMuted = !isMuted;
    muteBtn.setAttribute('aria-pressed', String(isMuted));
    muteBtn.textContent = isMuted ? '🔇' : '🔈';
  }
  muteBtn.addEventListener('click', toggleMute);
  themeToggle.addEventListener('change', (e) => {
    app.setAttribute('data-theme', e.target.checked ? 'arena' : 'neon');
    document.querySelectorAll('.vis').forEach(canvas => {
      const v = visMap.get(canvas);
      if (v && v.analyser) startVisualizer(canvas, v.analyser);
    });
  });

  function unlockAudio() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

})();
