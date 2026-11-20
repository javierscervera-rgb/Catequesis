# Catequesis · Parroquia San Sebastián Mártir

Web de la catequesis parroquial, publicada con GitHub Pages.

| Página | Para qué sirve |
|---|---|
| `index.html` | Portada: elegir Oratorio 1º, 2º, 3º, Juniors o Postcomunión |
| `oratorios.html` | Oratorios: lista con filtros, ficha y folleto en PDF (`oratorio-pdf.js`) |
| `catequesis-parroquia.html` | Juniors y Postcomunión: lista, ficha y Lectio Divina en PDF (`catequesis-pdf.js` + `lectio-plantilla.pdf`) |
| `catequesis-sesion.html` | Sesión de domingo en letra grande para el móvil (`?s=<id>`) |

Los datos están en `oratorios.json` y `catequesis-parroquia.json`. Las páginas los guardan solas
con un token *fine-grained* de GitHub (permiso **Contents: Read and write** sobre este repositorio),
que se pega en ⚙︎ y se queda solo en ese navegador.

## Subdominio catequesis.sansebastianmartir.es

1. **IONOS** → Dominios → sansebastianmartir.es → DNS → añadir registro **CNAME**:
   - Nombre de host: `catequesis`
   - Apunta a: `javierscervera-rgb.github.io`
2. **GitHub** → este repositorio → Settings → Pages → *Custom domain*: `catequesis.sansebastianmartir.es` → Save.
   Cuando se compruebe el DNS, marcar **Enforce HTTPS**.

`vendor/pdf-lib.min.js`: pdf-lib 1.17 (licencia MIT).
