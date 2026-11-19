# three.js Demo 4 · Projekt Steininger

Ein Bauablaufplan für ein dreigeschossiges Travertinhaus am Hang über dem See: sechs Zeichnungen eines Hauses, von der Baugrube bis zur Übergabe. Scrollen Sie in Zeichnung 01, und hinter der Tusche baut sich die Baustelle selbst: feine Schnitte durch das echte Gelände erscheinen in der Zeichnung, wandern, leuchten an ihren Kanten und wachsen zusammen. Dann wird der Scroll zum Kalender. Sie gehen über die Baustelle, während das Haus wächst, steigen über die Gerüsttreppe auf den Balkon, gehen in Woche 18 durch einen Wald aus Stützen, und sehen zu, wie drei Geschosse von oben nach unten eingerichtet werden. Am Ende öffnet sich die Schiebetür zur Poolterrasse.

[**Live ansehen**](https://seofessionals-3js.github.io/threejs-demo-4/) · [**Startprompt**](PROMPT.md) · [**Alle Demos**](https://seofessionals-3js.github.io/threejs-demos/)

## So funktioniert es

- **Jedes Bauteil kennt seine Woche.** Jedes Teil des Hauses, das Gelände, die Hilfskonstruktionen und die Möbel speichern die Woche, in der sie kommen, und die Woche, in der sie gehen. Eine einzige Uniform entscheidet, was existiert (`partWeeks` in `js/world.js`).
- **Sechs Zeichnungen, ein Modell.** Die sechs Kacheln sind dasselbe Live-Modell durch ein 2°-Objektiv, jede in ihrer eigenen Woche und jede in ihr eigenes Rechteck des Bildschirms gerendert (`aim()` in `js/pipe.js`).
- **Die Welt baut sich selbst.** Ein Kanten-Shader zeichnet die Kacheln. Beim Eintauchen erscheint die beleuchtete Baustelle als waagrechte Schnitte durch das echte Gelände, die sich bewegen und zusammenwachsen, mit einer Kante in Limette. Auf der Baustelle kommt jedes neue Bauteil und jedes Möbelstück auf dieselbe Weise an (`WEEKLY` in `js/world.js`).
- **Das Eintauchen** ist ein umgekehrter Dolly-Zoom von 2° auf 50° bis auf Augenhöhe. Danach folgt die Kamera sechs Spline-Abschnitten, während die Woche dem Scroll folgt: Baustelle, Stützen, Obergeschoss, Wohngeschoss, die Treppe hinab ins Poolgeschoss und hinaus auf die Terrasse.
- **Das Licht wandert mit den Wochen.** Morgens an der Baugrube, tiefe Sonne durch die Stützen in Woche 18, später Nachmittag bei der Übergabe. Die Sonnenstrahlen werden gegen die Shadow-Map der Sonne geraymarcht.

## Das Haus in Zahlen

Ebenen auf -3,20 (Poolgeschoss), 0,00 (Wohngeschoss) und +3,20 (Obergeschoss), Dächer auf +6,80 und +7,60. Grundfläche 14,6 mal 12 m in zwei Feldern. Der obere Baukörper des Nordfelds kragt 4,8 m über den Balkon aus. Hinten im Nordfeld liegt eine zweigeschossige Halle mit der Treppe. Der Pool misst 6,6 mal 11,2 m und steht auf der Böschung unter der Terrasse.

## Bedienung und Barrierefreiheit

- **Abspielen** (oder `P`) scrollt den Bau für Sie in gleichmäßigem Tempo. Mausrad, Berührung oder eine Scrolltaste übernehmen wieder.
- **Ansicht** öffnet die Optionen: Bewegung reduzieren (folgt auch der Systemeinstellung: keine Scanlinien, kein Nachlauf, die Zeichnungen stehen sofort), größere Beschriftung, höherer Kontrast (folgt auch der Systemeinstellung) und Sprünge zu zehn Kapiteln (Tasten `1` bis `0`). Die Auswahl wird im Browser gespeichert.
- Ein Screenreader bekommt eine Zusammenfassung der Bauphasen und eine gesprochene Zeile mit der aktuellen Woche. Das Blatt und der Schlusstext sind aus der Tab-Reihenfolge genommen, solange sie nicht zu sehen sind.

## Farben und Schriften

Papier `#f1f0e6`, Waldgrün `#10241a`, Blattgrün `#5fa512`, Limette `#c4f03e`. BBH Bogle für Überschriften, Arimo für alles, was gelesen wird. Beide Schriften liegen in `fonts/` (SIL Open Font License, Lizenztexte daneben). BBH Bogle enthält keine Umlaute, deshalb kommen die Überschriften ohne aus.

## Dateien

`index.html` (Blatt, Farben, Schriften, Kontakt), `js/programme.js` (die Phasen und Balken), `js/main.js` (Scrollen, Kamera, Wochen, HUD), `js/world.js` (Haus, Baustelle, Gelände, Pool, Materialien), `js/stage.js` (Möbel, Leuchten, Bepflanzung, Schiebetüren, Gerüsttreppe), `js/pipe.js` (die Tusche und der Durchgang, der die Baustelle dahinter aufbaut), `js/access.js` (Abspielen, Ansichtsoptionen, Kapitel, Tasten, gesprochene Zeile).

`?v=12.5` springt zu einer Scrollposition in Bildschirmhöhen. `?still` überspringt den Loader.

## Lokal starten

Die Seiten nutzen JavaScript-Module und brauchen deshalb einen lokalen Server. Ein Doppelklick auf `index.html` funktioniert nicht.

```bash
python -m http.server 8000
```

Dann http://localhost:8000/ öffnen. Am besten auf einem Laptop mit aktuellem Browser.

## Herkunft und Lizenz

Basiert auf „Build Time-Lapse“ aus [flat-to-3d](https://github.com/Sam1983Aing/flat-to-3d) von Samnang Aing, veröffentlicht unter der MIT-Lizenz. Haus, Kameraweg, Aufbau-Effekt, Gestaltung und Bedienung wurden für Projekt Steininger neu entwickelt. Die Lizenz liegt unverändert in [LICENSE](LICENSE).

Projekt Steininger ist ein erfundenes Haus. Konzept, UX und three.js-Umsetzung: Micha Schwan, UX Designer, schwanmicha07@gmail.com. three.js (MIT) wird von einem CDN geladen.
