let resultadosRR = [];
let resultadosSJF = [];

const RR_PALETTE = ['#4f8cff', '#f4b400', '#28a745', '#ff6b6b', '#8a63e6', '#00bfa6', '#ff9f43'];
const SJF_PALETTE = ['#FF6B6B', '#FFB86B', '#FFD166', '#6BCB77', '#4ECDC4', '#4D96FF', '#B388EB'];

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

function getPriorityRankVal(prio) {
    // returns a numeric rank such that smaller = higher priority for sorting
    const mode = (document.getElementById('platformSelect') && document.getElementById('platformSelect').value) || 'linux';
    const v = Number.parseInt(prio) || 0;
    return mode === 'linux' ? v : -v;
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
            <th>Llegada</th>
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
            <td><input type="number" value="0" min="0" id="p${i}_l"></td>
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
                llegada: Number.parseInt((document.getElementById(`p${i}_l`) && document.getElementById(`p${i}_l`).value) || 0) || 0
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
                <thead>
                    <tr><th>Proceso</th><th>Espera</th><th>Retorno</th></tr>
                </thead>
                <tbody>
        `;

        const ordered = res.slice().sort((a,b)=>{
            const ma = /P(\d+)/i.exec(a.nombre);
            const mb = /P(\d+)/i.exec(b.nombre);
            const na = ma ? Number.parseInt(ma[1],10) : a.nombre;
            const nb = mb ? Number.parseInt(mb[1],10) : b.nombre;
            if (typeof na === 'number' && typeof nb === 'number') return na - nb;
            return String(na).localeCompare(String(nb));
        });

        ordered.forEach(r => {
            tabla += `<tr><td>${r.nombre}</td><td>${r.espera}</td><td>${r.retorno}</td></tr>`;
        });

        tabla += `</tbody>`;

        // calcular promedios
        const count = res.length || 0;
        const avgEspera = count ? (res.reduce((a,b) => a + (b.espera||0), 0) / count) : 0;
        const avgRetorno = count ? (res.reduce((a,b) => a + (b.retorno||0), 0) / count) : 0;

        tabla += `
            <tfoot>
                <tr class="avg-row"><th>Promedio</th><th>${avgEspera.toFixed(2)}</th><th>${avgRetorno.toFixed(2)}</th></tr>
            </tfoot>
        `;

        tabla += `</table>`;

        document.getElementById("tablaResultados").innerHTML = tabla;
}

function computeSJF() {
    // SJF non-preemptive with arrivals: at each time select available job with smallest burst
    const procesos = getProcesos();

    // asignar colores por nombre de proceso (P1,P2,...) para consistencia
    const colorMap = {};
    for (const [idx, p] of procesos.entries()) {
        const exec = /P(\d+)/i.exec(String(p.nombre));
        const keyIdx = exec ? (Number.parseInt(exec[1], 10) - 1) : idx;
        colorMap[p.nombre] = SJF_PALETTE[(keyIdx) % SJF_PALETTE.length];
    }

    // preparar objetos con tipos numéricos
    const procesosObjs = procesos.map(p => ({
        nombre: p.nombre,
        tiempo: Number.parseInt(p.tiempo) || 0,
        prioridad: Number.parseInt(p.prioridad) || 0,
        llegada: Number.parseInt(p.llegada) || 0
    }));

    const remaining = procesosObjs.slice();
    let tiempo = 0;
    const gantt = [];
    const res = [];

    while (remaining.length > 0) {
        // procesos disponibles
        const disponibles = remaining.filter(p => p.llegada <= tiempo);
        if (disponibles.length === 0) {
            // avanzar al siguiente arribo
            const next = Math.min(...remaining.map(r => r.llegada));
            tiempo = Math.max(tiempo, next);
            continue;
        }

        disponibles.sort((a, b) => {
            if (a.tiempo !== b.tiempo) return a.tiempo - b.tiempo;
            if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
            if (a.llegada !== b.llegada) return a.llegada - b.llegada;
            return String(a.nombre).localeCompare(String(b.nombre));
        });

        const sel = disponibles[0];
        const start = Math.max(tiempo, sel.llegada);
        const completion = start + sel.tiempo;

        const waiting = start - sel.llegada;
        const turnaround = completion - sel.llegada;

        const color = colorMap[sel.nombre] || SJF_PALETTE[0];

        gantt.push({ nombre: sel.nombre, duracion: sel.tiempo, color });
        res.push({ nombre: sel.nombre, espera: waiting, retorno: turnaround });

        tiempo = completion;

        // eliminar seleccionado
        const ix = remaining.indexOf(sel);
        if (ix >= 0) remaining.splice(ix, 1);
    }

    resultadosSJF = res;
    return { gantt, res };
}

function computeRR() {
    let quantum = Number.parseInt(document.getElementById("quantum").value) || 1;
    const procesos = getProcesos().map((p, idx) => ({
        nombre: p.nombre,
        arrival: Number.parseInt(p.llegada) || 0,
        remaining: Number.parseInt(p.tiempo) || 0,
        burst: Number.parseInt(p.tiempo) || 0,
        prioridad: Number.parseInt(p.prioridad) || 0,
        color: (() => {
            const exec = /P(\d+)/i.exec(String(p.nombre));
            const keyIdx = exec ? (Number.parseInt(exec[1], 10) - 1) : idx;
            return RR_PALETTE[(keyIdx) % RR_PALETTE.length];
        })()
    }));

    const all = procesos.slice();
    let tiempo = 0;
    const gantt = [];
    const res = [];
    const ready = [];

    const notFinished = () => all.some(pr => pr.remaining > 0);

    while (notFinished()) {
        // push newly arrived
        for (const pr of all) {
            if (pr.arrival <= tiempo && pr.remaining > 0 && !ready.includes(pr)) ready.push(pr);
        }

        if (ready.length === 0) {
            // advance to next arrival
            const nextArr = Math.min(...all.filter(p => p.remaining > 0).map(p => p.arrival));
            tiempo = Math.max(tiempo, nextArr);
            for (const pr of all) {
                if (pr.arrival <= tiempo && pr.remaining > 0 && !ready.includes(pr)) ready.push(pr);
            }
            if (ready.length === 0) continue;
        }

        const p = ready.shift();
        const exec = Math.min(quantum, p.remaining);
        const start = tiempo;
        gantt.push({ nombre: p.nombre, duracion: exec, color: p.color });

        tiempo += exec;
        p.remaining -= exec;

        // enqueue processes that arrived during execution
        for (const pr of all) {
            if (pr.arrival > start && pr.arrival <= tiempo && pr.remaining > 0 && !ready.includes(pr) && pr !== p) ready.push(pr);
        }

        if (p.remaining > 0) {
            ready.push(p);
        } else {
            const completion = tiempo;
            const waiting = completion - p.arrival - p.burst;
            const turnaround = completion - p.arrival;
            res.push({ nombre: p.nombre, espera: waiting, retorno: turnaround });
        }
    }

    resultadosRR = res;
    return { gantt, res };
}

function computePriority() {
    // Priority scheduling (non-preemptive), Linux-style: smaller number = higher priority (executes earlier)
    const procesos = getProcesos().map(p => ({ ...p }));

    // stable color mapping by name (same as RR)
    const colorMap = {};
    for (const [idx, p] of procesos.entries()) {
        const exec = /P(\d+)/i.exec(String(p.nombre));
        const keyIdx = exec ? (Number.parseInt(exec[1], 10) - 1) : idx;
        colorMap[p.nombre] = RR_PALETTE[(keyIdx) % RR_PALETTE.length];
    }

    let tiempo = 0;
    const gantt = [];
    const res = [];

    const remaining = procesos.slice();

    while (remaining.length > 0) {
        // obtener procesos disponibles
        const disponibles = remaining.filter(p => (p.llegada || 0) <= tiempo);

        let seleccionado = null;
        if (disponibles.length === 0) {
            // avanzar al siguiente arribo
            const siguienteLlegada = Math.min(...remaining.map(r => r.llegada || 0));
            tiempo = Math.max(tiempo, siguienteLlegada);
            continue;
        } else {
            // elegir por prioridad: menor valor = mayor prioridad
            disponibles.sort((a, b) => {
                if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
                if ((a.llegada || 0) !== (b.llegada || 0)) return (a.llegada || 0) - (b.llegada || 0);
                return String(a.nombre).localeCompare(String(b.nombre));
            });
            seleccionado = disponibles[0];
        }

        // ejecutar seleccionado de forma no preemptive
        const start = Math.max(tiempo, seleccionado.llegada || 0);
        const completion = start + (seleccionado.tiempo || 0);
        const espera = start - (seleccionado.llegada || 0);
        const retorno = completion - (seleccionado.llegada || 0);

        gantt.push({ nombre: seleccionado.nombre, duracion: seleccionado.tiempo, color: colorMap[seleccionado.nombre] });
        res.push({ nombre: seleccionado.nombre, espera, retorno });

        tiempo = completion;

        // eliminar de remaining
        const idx = remaining.indexOf(seleccionado);
        if (idx >= 0) remaining.splice(idx, 1);
    }

    // guardar resultados
    window.resultadosPrioridad = res;
    return { gantt, res };
}

const animationState = { paused: false, stopped: false, speed: 1 };

let elapsedSeconds = 0;

function updateTimerLabel() {
    const el = document.getElementById('timerLabel');
    if (el) el.innerText = `${elapsedSeconds}s`;
}

function startTimer() {
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
    resetTimer();
    animationState.paused = false;
    animationState.stopped = false;
    const toggleBtn = document.getElementById('togglePlayBtn');
    if (toggleBtn) { toggleBtn.disabled = false; toggleBtn.innerText = 'Pausar'; }
    startTimer();
    animateGantt(gantt);
}

function simularPrioridad() {
    const { gantt, res } = computePriority();
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
    generarTabla();
    const simRRBtn = document.getElementById('simRRBtn');
    const simSJFBtn = document.getElementById('simSJFBtn');
    const compBtn = document.getElementById('comparativaBtn');
    const toggleBtn = document.getElementById('togglePlayBtn');

    if (toggleBtn) {
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