# VoltMarket Firebase beállítás és teszt

## Firebase projekt

- Projekt: `voltmarket-17bbc`
- Webalkalmazás: `VoltMarket Web`
- Authentication: Email/Password engedélyezve
- Firestore: Standard kiadás, `eur3` régió

## Helyi futtatás

A projekt statikus webalkalmazás, ezért egy egyszerű HTTP-szerver szükséges:

```bash
python3 -m http.server 4176
```

Ezután nyisd meg a `http://localhost:4176` címet.

## Tesztelési sorrend

1. Regisztrálj egy új e-mail/jelszó profilt.
2. Ellenőrizd a Beállítások oldalon a Firebase-fiókot.
3. Módosítsd a játékosnevet, majd frissítsd az oldalt.
4. Vásárolj egy terméket vagy indíts egy munkát.
5. Jelentkezz ki, majd vissza ugyanazzal a profillal.
6. Ellenőrizd, hogy a játékállapot visszatöltődött.
7. Az admin e-maillel (`martin.roszoly2002@gmail.com`) nyisd meg a Beállításokat.
8. A Játékosok panelen válaszd a **Lista frissítése** gombot.

## Firestore szabályok

A szabályok a `firestore.rules` fájlban találhatók. A játékosok a saját profiljukat írhatják/olvashatják, az admin e-mail pedig a játékoslistát is lekérheti.
