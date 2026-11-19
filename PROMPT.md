# Startprompt · three.js Demo 4

Der Prompt, mit dem ich anfangen würde, um diese Demo nachzubauen. Er liefert nicht genau diese Seite, sondern eine erste Version der Idee. Danach beginnt die eigentliche Arbeit.

Ersetzen Sie die Teile in `[eckigen Klammern]` durch Ihr eigenes Thema.

```text
Ich möchte eine scrollgesteuerte Landingpage bauen für [ein Planungs- und Bauunternehmen, Ihr
Thema], rund um ein [dreigeschossiges Travertinhaus am Hang über einem See].

Die Idee: Die Seite öffnet mit einem Bauablaufplan. Sechs kleine axonometrische Linienzeichnungen
desselben Hauses, eine pro Bauphase: [Aushub und Fundamente, Poolgeschoss, Wohndecke, Wände und
Decken, Dächer, Verglasung, Ausbau und Pool], jede mit ihren Wochen. Neben der Überschrift steht der
Bauzeitenplan, ein Balken pro Phase.

Der Scrollablauf, der Reihe nach:
1. Der Loader ist der Bauzeitenplan, der seine Balken zeichnet. Dann zeichnen sich alle sechs
   Zeichnungen gleichzeitig nach einer Uhr, frische Linien in Blattgrün, die zu Waldgrün
   abkühlen.
2. Das Papier zoomt in Zeichnung 01, bis sie den Bildschirm füllt. Hinter der Tusche baut sich
   in Bauabfolge die echte Baustelle auf: als waagrechte Schnitte durch das Gelände, die sich
   bewegen, an ihren Kanten in Limette leuchten und zusammenwachsen. Die Zeichnung bleibt dabei
   lesbar. Jedes Bauteil und jedes Möbelstück kommt später auf dieselbe Weise an.
3. Das Objektiv öffnet sich von 2 auf 50 Grad, während der Ausschnitt gehalten wird, und
   landet auf Augenhöhe am Rand der Baugrube.
4. Jetzt ist der Scroll der Kalender. Das Haus wächst Woche für Woche, während die Kamera
   [hinunter vor das Haus, eine Gerüsttreppe hinauf, auf den Balkon] geht. Die Verfüllung
   steigt vom Boden der Grube auf.
5. In [Woche 18] geht die Kamera durch einen Wald aus Stahlstützen unter der frischen Decke,
   und die Sonne schneidet zwischen ihnen hindurch. Dann steigt sie durch die Halle nach oben.
6. Ausbau und Möbel kommen rund um die Kamera an, Geschoss für Geschoss von oben nach unten:
   [Obergeschoss mit Bibliothek und Lounge, Wohngeschoss mit Küche und Wohnraum, Poolgeschoss
   mit Lounge, Sauna und Billard]. Die Schiebetür öffnet sich, die Kamera tritt auf die
   Poolterrasse und dreht sich zur Übergabe zum Haus um.
7. Am Tag der Übergabe fährt die Kamera über den Pool zurück in Zeichnung 06, das Haus wird in
   umgekehrter Reihenfolge wieder zur Zeichnung, und das Blatt kehrt mit vollen Balken zurück,
   dazu [Projekt starten].

Worauf es mir ankommt:
- Die Zeichnungen sind das 3D-Modell selbst, live von einem Kanten-Shader durch ein 2-Grad-
  Objektiv gezeichnet, jede Kachel in ihrer eigenen Woche. Jedes Teil des Hauses kennt die
  Woche, in der es gebaut wird, sodass eine einzige Zahl entscheidet, was existiert.
- Eine einzige Liste von Phasen steuert den Bauzeitenplan, die Zeichnungen und die Baustelle.
- Der Look: ein CAD-Bildschirm. Papier #f1f0e6, Waldgrün #10241a als Tusche, Blattgrün #5fa512
  auf Papier und Limette #c4f03e auf Dunkel, BBH Bogle für Überschriften, Arimo für
  Beschriftungen, Passermarken in den Ecken, ein Wochen-Chip und der Bauzeitenplan unten links
  angedockt mit einer „Heute“-Linie.
- Bedienbar für alle: eine Abspielen-Schaltfläche, die für mich scrollt, und Optionen für
  reduzierte Bewegung, größere Beschriftung, höheren Kontrast und Kapitelsprünge.
- three.js 0.160 von einem CDN, einfache Dateien, kein Build-Schritt. Keine Bilddateien, jede
  Textur wird im Code gezeichnet.

Bevor du Code schreibst, schlage das Haus mit Maßen vor, die ich mir vorstellen kann, die Woche
jeder Phase und den Kameraweg Station für Station, und warte auf meine Antwort. Dann baue in
Etappen. Nur die erste Etappe: der Loader, das Zeichnen des Blatts und das Eintauchen in
Zeichnung 01 bis auf Augenhöhe. Nimm es auf und zeig es mir, bevor du weitermachst.
```

Der letzte Absatz ist genauso wichtig wie die Idee. Ohne ihn bekommen Sie eine fertige Seite, die Sie nicht selbst ausgewählt haben.
