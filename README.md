# three.js Demo 4

Ein Bauablaufplan: sechs Zeichnungen eines Hauses, von der Baugrube bis zur Übergabe. Scrollen Sie in Zeichnung 01, und hinter der Tusche strömt die echte Baustelle herein. Dann wird der Scroll zum Kalender, und Sie gehen über die Baustelle, während das Haus um Sie herum Woche für Woche wächst, in Woche 18 durch einen Wald aus Stützen, bis zum Tag der Übergabe.

[**Live ansehen**](https://seofessionals-3js.github.io/threejs-demo-4/) · [**Startprompt**](PROMPT.md) · [**Alle Demos**](https://seofessionals-3js.github.io/threejs-demos/)

## So funktioniert es

- **Jedes Bauteil kennt seine Woche.** Jedes Teil des Hauses, das Gelände, die Hilfskonstruktionen und die Möbel speichern die Woche, in der sie kommen, und die Woche, in der sie gehen. Eine einzige Uniform entscheidet, was existiert (`partWeeks` in `js/world.js`).
- **Sechs Zeichnungen, ein Modell.** Die sechs Kacheln sind dasselbe Live-Modell durch ein 2°-Objektiv, jede in ihrer eigenen Woche und jede in ihr eigenes Rechteck des Bildschirms gerendert (`aim()` in `js/pipe.js`).
- **Von der Tusche zur Baustelle.** Ein Kanten-Shader zeichnet die Kacheln. Beim Eintauchen wird die beleuchtete Baustelle überall dort eingeblendet, wo die Woche eines Pixels erreicht ist, mit einem bernsteinfarbenen Rand.
- **Das Eintauchen** ist ein umgekehrter Dolly-Zoom von 2° auf 50° bis auf Augenhöhe. Danach folgt die Kamera vier Spline-Abschnitten, während die Woche dem Scroll folgt.
- **Das Licht wandert mit den Wochen.** Morgens an der Baugrube, tiefe Sonne durch die Stützen in Woche 18, später Nachmittag bei der Übergabe. Die Sonnenstrahlen werden gegen die Shadow-Map der Sonne geraymarcht.

## Dateien

`index.html`, `js/programme.js` (die Phasen und Balken), `js/main.js` (Scrollen, Kamera, Wochen, HUD), `js/world.js` (Haus, Baustelle, Gelände, Materialien), `js/stage.js` (Möbel, Gerüsttreppe), `js/pipe.js` (die Tusche und das Post-Processing). Insgesamt etwa 180 KB.

`?v=12.5` springt zu einer Scrollposition in Bildschirmhöhen. `?still` überspringt den Loader.

## Lokal starten

Die Seiten nutzen JavaScript-Module und brauchen deshalb einen lokalen Server. Ein Doppelklick auf `index.html` funktioniert nicht.

```bash
python -m http.server 8000
```

Dann http://localhost:8000/ öffnen. Am besten auf einem Laptop mit aktuellem Browser.

## Herkunft und Lizenz

Basiert auf „Build Time-Lapse“ aus [flat-to-3d](https://github.com/Sam1983Aing/flat-to-3d) von Samnang Aing, veröffentlicht unter der MIT-Lizenz, und ins Deutsche übersetzt. Die Lizenz liegt unverändert in [LICENSE](LICENSE).

Alle Büros, Häuser, Adressen und Kontaktdaten in der Demo sind erfunden. three.js (MIT) wird von einem CDN geladen, die Schriften Chakra Petch und IBM Plex Mono von Google Fonts (SIL Open Font License).
