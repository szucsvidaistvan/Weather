# Mit vigyek? Időjárás

Saját időjárás-PWA. Reggeli döntéshez (esernyő, pulcsi, napszemüveg) és előre tervezéshez (16 nap, hétvége, legközelebbi szép nap).

- Adatok: [Open-Meteo](https://open-meteo.com) (ingyenes, kulcs nélkül)
- A közelebbi napok a legjobb helyi modellből, a távolabbiak ECMWF, ICON, GFS és Météo-France modellek mediánjából jönnek
- A megbízhatóság jele a modellek egyetértéséből és a távolságból számolódik
- Offline is megnyílik: az utolsó letöltött előrejelzést mutatja

Indítás: bármilyen statikus szerverről (pl. `python3 -m http.server`), telefonon a „Hozzáadás a kezdőképernyőhöz" opcióval telepíthető.
