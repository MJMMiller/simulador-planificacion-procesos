let resultadosRR = [];
let resultadosSJF = [];

const RR_PALETTE = ['#4f8cff', '#f4b400', '#28a745', '#ff6b6b', '#8a63e6', '#00bfa6', '#ff9f43'];
const SJF_PALETTE = ['#f28ab2', '#ffe2a3', '#b3f0c1', '#c6d8ff', '#ffd1e3', '#e8d4a2', '#d0f4f1'];

function textColorForBg(hex) {
    if (!hex) return '#fff';
    // limpiar
    const h = hex.replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const r = parseInt(full.substring(0,2),16);
    const g = parseInt(full.substring(2,4),16);
    const b = parseInt(full.substring(4,6),16);
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    return lum > 160 ? '#111' : '#fff';
}

function colorRandom() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

function generarTabla() {
    let total = Number.parseInt(document.getElementById("totalProcesos").value) || 1;
    let tabla = document.getElementById("tablaProcesos");

    tabla.innerHTML = `
        <thead>
        <tr>
            <th>Nombre</th>
            <th>Tiempo</th>
            <th>Prioridad</th>
        </tr>
        </thead>
        <tbody id="tablaBody"></tbody>
    `;

    let body = document.getElementById('tablaBody');
    body.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        let row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" value="P${i}" id="p${i}_n"></td>
            <td><input type="number" value="1" min="1" id="p${i}_t"></td>
            <td><input type="number" value="1" min="1" id="p${i}_pri"></td>
        `;
        body.appendChild(row);
    }
}

function getProcesos() {
    let total = Number.parseInt(document.getElementById("totalProcesos").value) || 1;
    let proces = [];

    for (let i = 1; i <= total; i++) {
        let nombreEl = document.getElementById(`p${i}_n`);
        let tiempoEl = document.getElementById(`p${i}_t`);
        let priEl = document.getElementById(`p${i}_pri`);
        if (!nombreEl || !tiempoEl || !priEl) continue;
        proces.push({
            nombre: nombreEl.value || `P${i}`,
            tiempo: Number.parseInt(tiempoEl.value) || 1,
            prioridad: Number.parseInt(priEl.value) || 1,
            llegada: 0
        });
    }
    return proces;
}

function dibujarGantt(barras) {
    let div = document.getElementById("ganttContainer");
    div.innerHTML = "";
    for (const b of barras) {
        const el = document.createElement("div");
        el.className = "barra";
        el.style.background = b.color;
        el.style.color = textColorForBg(b.color);
        el.style.width = Math.max(30, b.duracion * 28) + "px";
        el.innerText = b.nombre;
        div.appendChild(el);
    }
}

function mostrarResultados(res) {
    let tabla = `
        <table>
        <tr><th>Proceso</th><th>Espera</th><th>Retorno</th></tr>
    `;
    res.forEach(r => {
        tabla += `<tr><td>${r.nombre}</td><td>${r.espera}</td><td>${r.retorno}</td></tr>`;
    });
    tabla += "</table>";

    document.getElementById("tablaResultados").innerHTML = tabla;
}

function computeSJF() {
    let procesos = getProcesos();
    procesos.sort((a, b) => a.tiempo - b.tiempo);

    let tiempo = 0;
    let gantt = [];
    let res = [];

    for (let i = 0; i < procesos.length; i++) {
        const p = procesos[i];
        const color = SJF_PALETTE[i % SJF_PALETTE.length];

        gantt.push({ nombre: p.nombre, duracion: p.tiempo, color });

        res.push({
            nombre: p.nombre,
            espera: tiempo,
            retorno: tiempo + p.tiempo
        });

        tiempo += p.tiempo;
    }

    resultadosSJF = res;
    return { gantt, res };
}

function computeRR() {
    let quantum = Number.parseInt(document.getElementById("quantum").value) || 1;
    let procesos = getProcesos();

    const colorMap = {};
        for (const [idx, p] of procesos.entries()) {
            const exec = /P(\d+)/i.exec(String(p.nombre));
            const keyIdx = exec ? (Number.parseInt(exec[1], 10) - 1) : idx;
            colorMap[p.nombre] = RR_PALETTE[(keyIdx) % RR_PALETTE.length];
    }

    let cola = procesos.map(p => ({
        nombre: p.nombre,
        tiempoRestante: p.tiempo,
        tiempo: p.tiempo,
        color: colorMap[p.nombre] || colorRandom(),
        inicio: null
    }));

    let tiempo = 0;
    let gantt = [];
    let res = [];

    while (cola.length > 0) {
        let p = cola.shift();
        let ejecutar = Math.min(quantum, p.tiempoRestante);

        gantt.push({ nombre: p.nombre, duracion: ejecutar, color: p.color });

        if (p.inicio === null) p.inicio = tiempo;

        tiempo += ejecutar;
        p.tiempoRestante -= ejecutar;

        if (p.tiempoRestante > 0) {
            cola.push(p);
        } else {
            res.push({
                nombre: p.nombre,
                espera: p.inicio,
                retorno: tiempo
            });
        }
    }

    resultadosRR = res;
    return { gantt, res };
}

const animationState = { paused: false, stopped: false, speed: 1 };

// Timer / play-pause control (logical seconds of the simulation)
let elapsedSeconds = 0;

function updateTimerLabel() {
    const el = document.getElementById('timerLabel');
    if (el) el.innerText = `${elapsedSeconds}s`;
}

function startTimer() {
    // marker, actual updates happen inside animateGantt based on logical progress
    animationState.timerRunning = true;
}

function stopTimer() {
    animationState.timerRunning = false;
}

function resetTimer() {
    elapsedSeconds = 0;
    updateTimerLabel();
}

function setSpeed(v) {
    animationState.speed = Number.parseFloat(v) || 1;
    const lbl = document.getElementById('speedLabel');
    if (lbl) lbl.innerText = animationState.speed + 'x';
}

async function animateGantt(gantt) {
    const barras = Array.from(document.querySelectorAll('#ganttContainer .barra'));
    const stepsList = document.getElementById('stepsList');
    const progressFill = document.getElementById('progressFill');
    stepsList.innerHTML = '';
    if (progressFill) progressFill.style.width = '0%';

    const total = gantt.reduce((a, b) => a + (b.duracion || 0), 0) || 1;

    for (let i = 0; i < gantt.length; i++) {
        const s = gantt[i];
        const li = document.createElement('li');
        li.id = 'step-' + i;
        li.innerHTML = `<div class="dot" style="background:${s.color || '#dbe9ff'}"></div><span>${s.nombre} (${s.duracion})</span>`;
        stepsList.appendChild(li);
    }

    animationState.stopped = false;

    let elapsedUnits = 0;

    for (let i = 0; i < gantt.length; i++) {
        if (animationState.stopped) break;
        const seg = gantt[i];
        const bar = barras[i];
        const li = document.getElementById('step-' + i);

        if (seg && seg.color && bar) bar.style.background = seg.color;
        if (bar) bar.classList.add('active');
        if (li) li.classList.add('active');

        const segMs = (seg.duracion || 1) * 600 / animationState.speed;
        const segStart = Date.now();
        let pausedAccum = 0;
        let pauseStartedAt = null;

        while (true) {
            if (animationState.stopped) break;

            // handle pause: accumulate paused time so it doesn't count towards segMs
            if (animationState.paused) {
                if (pauseStartedAt === null) pauseStartedAt = Date.now();
                await new Promise(r => setTimeout(r, 120));
                continue;
            } else {
                if (pauseStartedAt !== null) {
                    pausedAccum += Date.now() - pauseStartedAt;
                    pauseStartedAt = null;
                }
            }

            const now = Date.now();
            const elapsedMs = now - segStart - pausedAccum;
            if (elapsedMs >= segMs) break;

            const totalElapsedUnits = elapsedUnits + (elapsedMs / segMs) * (seg.duracion || 0);
            // update logical seconds label (floor)
            const logicalSeconds = Math.floor(totalElapsedUnits);
            if (logicalSeconds !== elapsedSeconds) {
                elapsedSeconds = logicalSeconds;
                updateTimerLabel();
            }

            const pct = Math.min(100, (totalElapsedUnits / total) * 100);
            if (progressFill) progressFill.style.width = pct.toFixed(2) + '%';

            await new Promise(r => setTimeout(r, 60));
        }

        if (animationState.stopped) break;

        elapsedUnits += seg.duracion || 0;

        // ensure progress reaches the updated point after finishing this segment
        const pctAfter = Math.min(100, (elapsedUnits / total) * 100);
        if (progressFill) progressFill.style.width = pctAfter.toFixed(2) + '%';

        if (bar) { bar.classList.remove('active'); bar.classList.add('done'); }
        if (li) { li.classList.remove('active'); li.classList.add('done'); }
    }

    if (!animationState.stopped && progressFill) progressFill.style.width = '100%';

    // animation finished
    stopTimer();
    const toggleBtn = document.getElementById('togglePlayBtn');
    if (toggleBtn) {
        toggleBtn.innerText = 'Iniciar';
        toggleBtn.disabled = true;
    }
}

function simularSJF() {
    const { gantt, res } = computeSJF();
    dibujarGantt(gantt);
    mostrarResultados(res);
    // prepare timer and controls
    resetTimer();
    animationState.paused = false;
    animationState.stopped = false;
    const toggleBtn = document.getElementById('togglePlayBtn');
    if (toggleBtn) { toggleBtn.disabled = false; toggleBtn.innerText = 'Pausar'; }
    startTimer();
    animateGantt(gantt);
}

function simularRR() {
    const { gantt, res } = computeRR();
    dibujarGantt(gantt);
    mostrarResultados(res);
    // prepare timer and controls
    resetTimer();
    animationState.paused = false;
    animationState.stopped = false;
    const toggleBtn = document.getElementById('togglePlayBtn');
    if (toggleBtn) { toggleBtn.disabled = false; toggleBtn.innerText = 'Pausar'; }
    startTimer();
    animateGantt(gantt);
}

function stopAnimation() {
    animationState.stopped = true;
    animationState.paused = false;
    const bars = document.querySelectorAll('#ganttContainer .barra');
    for (const b of bars) b.classList.remove('active','done');
    const steps = document.querySelectorAll('#stepsList li');
    for (const s of steps) s.classList.remove('active','done');
    const progressFill = document.getElementById('progressFill');
    if (progressFill) progressFill.style.width = '0%';
    // stop timer and reset label
    stopTimer();
    const toggleBtn = document.getElementById('togglePlayBtn');
    if (toggleBtn) { toggleBtn.innerText = 'Iniciar'; toggleBtn.disabled = true; }
    elapsedSeconds = 0;
    updateTimerLabel();
}


function mostrarGrafica() {
    const canvas = document.getElementById("grafica");
    canvas.style.display = "block";
    let ctx = canvas.getContext("2d");

    if (!resultadosRR.length || !resultadosSJF.length) {
        alert('Ejecuta/Simula ambos algoritmos primero para comparar.');
        return;
    }

    let esperaRR = resultadosRR.reduce((a, b) => a + b.espera, 0) / resultadosRR.length;
    let esperaSJF = resultadosSJF.reduce((a, b) => a + b.espera, 0) / resultadosSJF.length;

    let retornoRR = resultadosRR.reduce((a, b) => a + b.retorno, 0) / resultadosRR.length;
    let retornoSJF = resultadosSJF.reduce((a, b) => a + b.retorno, 0) / resultadosSJF.length;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Espera Promedio', 'Retorno Promedio'],
            datasets: [
                {
                    label: 'Round Robin',
                    data: [esperaRR, retornoRR],
                    backgroundColor: '#1D428A'
                },
                {
                    label: 'SJF',
                    data: [esperaSJF, retornoSJF],
                    backgroundColor: '#28A745'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // generar tabla inicial
    generarTabla();
    const simRRBtn = document.getElementById('simRRBtn');
    const simSJFBtn = document.getElementById('simSJFBtn');
    const compBtn = document.getElementById('comparativaBtn');
    const toggleBtn = document.getElementById('togglePlayBtn');

    if (toggleBtn) {
        // single click: toggle pause/resume for timeline, Gantt and timer
        toggleBtn.addEventListener('click', () => {
            if (animationState.stopped) return;
            animationState.paused = !animationState.paused;
            toggleBtn.innerText = animationState.paused ? 'Iniciar' : 'Pausar';
        });
    }

    if (simRRBtn) simRRBtn.addEventListener('click', () => { stopAnimation(); setTimeout(() => simularRR(), 60); });
    if (simSJFBtn) simSJFBtn.addEventListener('click', () => { stopAnimation(); setTimeout(() => simularSJF(), 60); });
    if (compBtn) compBtn.addEventListener('click', () => mostrarGrafica());
});