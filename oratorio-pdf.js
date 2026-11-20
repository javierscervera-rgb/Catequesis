/* ============================================================
   Folleto del oratorio en PDF (A4), con pdf-lib.
   Cabecera con curso, número y fecha; título; gracia de la reunión;
   ficha rápida (texto, oración, cantos); versículo clave; y los doce
   momentos del oratorio con sus rúbricas. Pasa de página solo.
   Uso: OratorioPDF.descargar(registro) · OratorioPDF.generar(registro) → Uint8Array
   ============================================================ */
(function (raiz) {
  "use strict";
  const LIB = "vendor/pdf-lib.min.js";
  const A4 = [595.28, 841.89], M = 52, W = A4[0] - 2 * M, PIE = 40;
  const COL = {
    banda: [164, 83, 63], tinta: [42, 36, 29], gris: [122, 110, 96], acento: [164, 83, 63], oro: [142, 106, 18],
    crema: [251, 245, 236], borde: [221, 207, 186], linea: [232, 222, 208], blanco: [255, 255, 255]
  };
  const CURSOS = { "1": ["PRIMER CURSO", "viernes"], "2": ["SEGUNDO CURSO", "martes"], "3": ["TERCER CURSO", "miércoles"] };
  const TIEMPOS = { "t.o.": "Tiempo ordinario", "adv.": "Adviento", "nav.": "Navidad", "epif.": "Epifanía", "cuar.": "Cuaresma", "pasc.": "Pascua", "1ª com": "Primera Comunión", "1ª conf": "Primera Confesión" };
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fechaLarga = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ""); if (!m) return ""; const d = new Date(+m[1], m[2] - 1, +m[3]); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${m[1]}`; };

  const MOMENTOS = [
    { f: "preparacion", n: 1, t: "Preparación previa" },
    { f: "entrada", n: 2, t: "Entrada y saludo personal", r: "Ponemos música tranquila con el altavoz." },
    { n: 3, t: "Oración de la semana y oración en voz alta", r: r => `De pie, alrededor de la alfombra, con las manos juntas. Señal de la cruz, oración de la semana${r.oracion ? ` («${r.oracion}»)` : ""} y gloria. A continuación, con las manos extendidas, el catequista hace su oración en voz alta y los niños van repitiendo frases sencillas, cortas y piadosas.` },
    { f: "memoria", n: 4, t: "Memoria del encuentro anterior" },
    { f: "oracionCorazon", n: 5, t: "Oración del corazón y canto meditativo", fin: r => r.canto ? `Al terminar cantamos: ${r.canto}` : "" },
    { f: "introPalabra", n: 6, t: "Introducción a la Palabra de Dios" },
    { f: "escuchaPalabra", n: 7, t: "Escucha de la Palabra" },
    { f: "comentario", n: 8, t: "Comentario de la Palabra" },
    { f: "aplicacion", n: 9, t: "Aplicación a la vida" },
    { f: "oracionesComun", n: 10, t: "Oraciones en común" },
    { f: "oracionFinal", n: 11, t: "Oración final y canto de salida", fin: r => r.cantoFinal ? `Al terminar cantamos para dar gracias: ${r.cantoFinal}` : "" },
    { f: "despedida", n: 12, t: "Despedida y salida" }
  ];

  function cargarLib() {
    if (raiz.PDFLib) return Promise.resolve(raiz.PDFLib);
    if (typeof require === "function" && typeof window === "undefined") return Promise.resolve(require("pdf-lib"));
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = LIB; s.onload = () => ok(raiz.PDFLib); s.onerror = () => mal(new Error("No se pudo cargar pdf-lib")); document.head.appendChild(s); });
  }
  const SUST = { "‘": "'", "’": "'", "“": "\"", "”": "\"", " ": " ", "\t": "    ", "–": "-", "—": "—" };
  function limpio(font, s) {
    const ok = new Set(font.getCharacterSet());
    return [...String(s || "")].map(ch => {
      if (ch === "\n") return ch;
      if (ok.has(ch.codePointAt(0))) return ch;
      const t = SUST[ch]; if (t !== undefined && [...t].every(c => ok.has(c.codePointAt(0)))) return t;
      if (t !== undefined) return t === "—" ? "-" : t;
      const sin = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return sin && ok.has(sin.codePointAt(0)) ? sin : "";
    }).join("");
  }
  function partir(font, size, texto, ancho) {
    const out = [];
    for (const p of String(texto).split("\n")) {
      const ws = p.split(/ +/).filter(Boolean);
      if (!ws.length) { out.push(""); continue; }
      let l = "";
      for (const w of ws) {
        const t = l ? l + " " + w : w;
        if (font.widthOfTextAtSize(t, size) <= ancho || !l) l = t; else { out.push(l); l = w; }
      }
      out.push(l);
    }
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  }

  async function generar(r) {
    const L = await cargarLib();
    const rgb = c => L.rgb(c[0] / 255, c[1] / 255, c[2] / 255);
    const doc = await L.PDFDocument.create();
    const F = {
      sans: await doc.embedFont(L.StandardFonts.Helvetica), sansB: await doc.embedFont(L.StandardFonts.HelveticaBold),
      ser: await doc.embedFont(L.StandardFonts.TimesRoman), serB: await doc.embedFont(L.StandardFonts.TimesRomanBold),
      serI: await doc.embedFont(L.StandardFonts.TimesRomanItalic)
    };
    const T = (f, s) => limpio(f, s);
    let pg, y;   // y = distancia desde ARRIBA
    const paginas = [];
    const nueva = () => { pg = doc.addPage(A4); paginas.push(pg); y = M; if (paginas.length > 1) cabeceraCorta(); };
    const queda = () => A4[1] - PIE - 14 - y;
    const asegura = h => { if (queda() < h) nueva(); };
    const texto = (t, x, yb, font, size, color, opts) => pg.drawText(t, Object.assign({ x, y: A4[1] - yb, size, font, color: rgb(color) }, opts || {}));
    const centro = (t, yb, font, size, color, x0 = M, w = W) => texto(t, x0 + (w - font.widthOfTextAtSize(t, size)) / 2, yb, font, size, color);
    const caja = (x, yt, w, h, fill, border, rad = 8) => pg.drawSvgPath(
      `M ${x + rad} 0 H ${x + w - rad} Q ${x + w} 0 ${x + w} ${rad} V ${h - rad} Q ${x + w} ${h} ${x + w - rad} ${h} H ${x + rad} Q ${x} ${h} ${x} ${h - rad} V ${rad} Q ${x} 0 ${x + rad} 0 Z`,
      { x: 0, y: A4[1] - yt, color: fill ? rgb(fill) : undefined, borderColor: border ? rgb(border) : undefined, borderWidth: border ? 0.8 : 0 });
    const espaciado = (t, x, yb, font, size, color, esp) => { for (const ch of t) { texto(ch, x, yb, font, size, color); x += font.widthOfTextAtSize(ch, size) + esp; } };
    const anchoEsp = (t, font, size, esp) => [...t].reduce((a, ch) => a + font.widthOfTextAtSize(ch, size) + esp, -esp);

    const curso = CURSOS[r.curso] || ["ORATORIO", ""];
    const titulo = T(F.serB, (r.nombre || "Oratorio").trim());
    const tiempo = TIEMPOS[(r.tiempo || "").trim().toLowerCase()] || (r.tiempo || "");

    function cabeceraCorta() {
      const t = T(F.sans, `Oratorio nº ${r.n || "—"} · ${curso[0].toLowerCase()} · ${(r.nombre || "").trim()}`);
      texto(t.length > 95 ? t.slice(0, 92) + "…" : t, M, M - 18, F.sans, 8, COL.gris);
      pg.drawLine({ start: { x: M, y: A4[1] - M + 12 }, end: { x: M + W, y: A4[1] - M + 12 }, thickness: 0.5, color: rgb(COL.linea) });
      y = M + 4;
    }

    /* ---- Página 1: cabecera ---- */
    nueva();
    pg.drawRectangle({ x: 0, y: A4[1] - 104, width: A4[0], height: 104, color: rgb(COL.banda) });
    espaciado(T(F.sansB, `ORATORIO · ${curso[0]}${curso[1] ? " · " + curso[1].toUpperCase() : ""}`), M, 40, F.sansB, 8.5, COL.blanco, 1.6);
    texto(T(F.serB, `Oratorio nº ${r.n || "—"}`), M, 72, F.serB, 26, COL.blanco);
    if (r.cronologia) texto(T(F.sans, r.cronologia), M, 89, F.sans, 9.5, [245, 225, 214]);
    const fl = T(F.serI, fechaLarga(r.fecha));
    if (fl) texto(fl, M + W - F.serI.widthOfTextAtSize(fl, 13), 70, F.serI, 13, COL.blanco);
    if (tiempo) {
      const tt = T(F.sansB, tiempo.toUpperCase()), w = anchoEsp(tt, F.sansB, 7.5, 1) + 16;
      caja(M + W - w, 80, w, 16, [255, 255, 255], null, 8);
      espaciado(tt, M + W - w + 8, 91, F.sansB, 7.5, COL.banda, 1);
    }
    y = 134;
    for (const l of partir(F.serB, 25, titulo.toUpperCase(), W)) { centro(l, y, F.serB, 25, COL.tinta); y += 28; }
    if (r.subtitulo) { for (const l of partir(F.serI, 14, T(F.serI, r.subtitulo), W - 40)) { centro(l, y, F.serI, 14, COL.acento); y += 18; } }
    if (r.numOriginal) { centro(T(F.sans, `nº ${r.numOriginal} del original`), y + 2, F.sans, 8, COL.gris); y += 12; }
    pg.drawLine({ start: { x: M + W / 2 - 40, y: A4[1] - y - 6 }, end: { x: M + W / 2 + 40, y: A4[1] - y - 6 }, thickness: 1, color: rgb(COL.oro) });
    y += 22;

    /* ---- Gracia de la reunión ---- */
    if ((r.gracia || "").trim()) {
      const ls = partir(F.serI, 12, T(F.serI, r.gracia.trim()), W - 40);
      const h = 34 + ls.length * 16 + 8;
      asegura(h);
      caja(M, y, W, h, COL.crema, COL.borde, 10);
      espaciado("GRACIA DE LA REUNIÓN", M + 20, y + 20, F.sansB, 7.5, COL.acento, 1.4);
      let yy = y + 38;
      for (const l of ls) { texto(l, M + 20, yy, F.serI, 12, COL.tinta); yy += 16; }
      y += h + 14;
    }

    /* ---- Ficha rápida: 2 × 2 ---- */
    {
      const cel = [["TEXTO", (r.escuchaPalabra || "").split("\n")[0].trim()], ["ORACIÓN EN VOZ ALTA", r.oracion], ["CANTO MEDITATIVO", r.canto], ["CANTO FINAL", r.cantoFinal]];
      const cw = (W - 10) / 2, hcel = 42;
      asegura(hcel * 2 + 10);
      cel.forEach(([lab, val], i) => {
        const x = M + (i % 2) * (cw + 10), yt = y + Math.floor(i / 2) * (hcel + 8);
        caja(x, yt, cw, hcel, null, COL.borde, 8);
        espaciado(lab, x + 12, yt + 15, F.sansB, 6.8, COL.gris, 1.2);
        let v = T(F.serB, val || "—"); while (F.serB.widthOfTextAtSize(v, 12) > cw - 24 && v.length > 4) v = v.slice(0, -2);
        if (v !== T(F.serB, val || "—")) v = v.trim() + "…";
        texto(v, x + 12, yt + 32, F.serB, 12, COL.tinta);
      });
      y += hcel * 2 + 8 + 16;
    }

    /* ---- Versículo clave ---- */
    if ((r.versiculo || "").trim()) {
      const ls = partir(F.serI, 14, T(F.serI, "«" + r.versiculo.trim().replace(/^[«"“]+|[»"”]+$/g, "") + "»"), W - 60);
      const h = 30 + ls.length * 18 + 6;
      asegura(h);
      pg.drawLine({ start: { x: M, y: A4[1] - y }, end: { x: M + W, y: A4[1] - y }, thickness: 0.6, color: rgb(COL.oro) });
      espaciado("VERSÍCULO CLAVE", M + (W - anchoEsp("VERSÍCULO CLAVE", F.sansB, 7.5, 1.4)) / 2, y + 16, F.sansB, 7.5, COL.oro, 1.4);
      let yy = y + 34;
      for (const l of ls) { centro(l, yy, F.serI, 14, COL.oro); yy += 18; }
      y += h; pg.drawLine({ start: { x: M, y: A4[1] - y }, end: { x: M + W, y: A4[1] - y }, thickness: 0.6, color: rgb(COL.oro) });
      y += 20;
    }

    /* ---- Momentos del oratorio ---- */
    const parrafo = (txt, font, size, color, sangria = 0, inter = 1.42) => {
      for (const l of partir(font, size, T(font, txt), W - sangria)) {
        if (!l) { y += size * 0.55; continue; }
        asegura(size * inter); texto(l, M + sangria, y + size, font, size, color); y += size * inter;
      }
    };
    for (const m of MOMENTOS) {
      const cuerpo = m.f ? (r[m.f] || "").trim() : "";
      const rub = typeof m.r === "function" ? m.r(r) : (m.r || "");
      const fin = m.fin ? m.fin(r) : "";
      if (!cuerpo && !rub && !fin) continue;
      asegura(60);
      // número en círculo + título + filete
      pg.drawCircle({ x: M + 10, y: A4[1] - y - 9, size: 10, color: rgb(COL.acento) });
      const nt = String(m.n); texto(nt, M + 10 - F.sansB.widthOfTextAtSize(nt, 9) / 2, y + 12.2, F.sansB, 9, COL.blanco);
      const tit = T(F.sansB, m.t.toUpperCase());
      espaciado(tit, M + 28, y + 13, F.sansB, 9.5, COL.tinta, 0.8);
      const fx = M + 28 + anchoEsp(tit, F.sansB, 9.5, 0.8) + 10;
      if (fx < M + W) pg.drawLine({ start: { x: fx, y: A4[1] - y - 9.5 }, end: { x: M + W, y: A4[1] - y - 9.5 }, thickness: 0.5, color: rgb(COL.linea) });
      y += 26;
      if (rub) { parrafo(rub, F.serI, 10, COL.acento, 28, 1.35); y += 3; }
      if (cuerpo) parrafo(cuerpo, m.f === "escuchaPalabra" ? F.serI : F.ser, 11, COL.tinta, 28, 1.4);
      if (fin) { y += 2; parrafo(fin, F.serI, 10.5, COL.acento, 28, 1.35); }
      y += 14;
    }

    /* ---- Observaciones finales ---- */
    if ((r.observaciones || "").trim()) {
      const ls = partir(F.ser, 10.5, T(F.ser, r.observaciones.trim()), W - 32);
      const h = 30 + ls.length * 14.5 + 6;
      if (h < A4[1] - 2 * M - PIE) asegura(h);
      caja(M, y, W, h, [250, 238, 232], [226, 190, 176], 10);
      espaciado("OBSERVACIONES FINALES", M + 16, y + 18, F.sansB, 7.5, COL.acento, 1.4);
      let yy = y + 34;
      for (const l of ls) { if (l) texto(l, M + 16, yy, F.ser, 10.5, COL.tinta); yy += l ? 14.5 : 7; }
      y += h;
    }

    /* ---- Pie de página ---- */
    paginas.forEach((p, i) => {
      const t = `${i + 1} / ${paginas.length}`;
      p.drawText(t, { x: M + W - F.sans.widthOfTextAtSize(t, 8), y: PIE - 14, size: 8, font: F.sans, color: rgb(COL.gris) });
      p.drawText(limpio(F.sans, "Parroquia San Sebastián Mártir · Oratorios"), { x: M, y: PIE - 14, size: 8, font: F.sans, color: rgb(COL.gris) });
    });
    doc.setTitle(`Oratorio nº ${r.n || ""} · ${(r.nombre || "").trim()}`);
    doc.setAuthor("Catequesis parroquial");
    return doc.save();
  }

  const nombre = r => (`Oratorio ${(CURSOS[r.curso] || [""])[0].toLowerCase()} ${r.n || ""} ${(r.nombre || "").replace(/^\.+\s*/, "")}`.replace(/[\\/:*?"<>|¿?¡!.…]/g, "").replace(/\s+/g, " ").trim() || "Oratorio") + ".pdf";
  async function descargar(r) {
    const bytes = await generar(r);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); a.download = nombre(r);
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const api = { generar, descargar, nombre };
  if (typeof module === "object" && module.exports) module.exports = api;
  raiz.OratorioPDF = api;
})(typeof window !== "undefined" ? window : globalThis);
