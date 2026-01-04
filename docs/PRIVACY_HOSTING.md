Hosting rápido de la Política de Privacidad (GitHub Pages)
-----------------------------------------------------

1) Crear un repo remoto en GitHub si no existe (o usar el repo actual) y subir estos archivos.

2) Ramas y GitHub Pages
- Opción A (docs/ folder): GitHub Pages puede servir desde la rama `main` / carpeta `docs/`. Copia `privacy/index.html` a `docs/privacy/index.html` y activa Pages en `Settings → Pages → Source: main / (docs/)`.
- Opción B (gh-pages): usa la rama `gh-pages` y sube el contenido de `privacy/` a la raíz de esa rama.

3) URL resultante (ejemplo):
- Si usas docs/ y tu repo es `https://github.com/TU_USUARIO/mi-repo`, la URL será:
  `https://TU_USUARIO.github.io/mi-repo/privacy/`

4) Pasos rápidos (desde tu máquina):

```bash
# desde el root del proyecto
git add privacy/index.html PRIVACY.md
git commit -m "Add privacy policy and hosting instructions"
git push origin main

# mover a docs/ si prefieres esa opción
mkdir -p docs/privacy
cp privacy/index.html docs/privacy/index.html
git add docs/privacy/index.html
git commit -m "Publish privacy page to docs/ for GitHub Pages"
git push origin main
```

5) En Play Console -> App content -> Privacy policy pega la URL pública (https) que obtengas.

Notas de seguridad
- Asegúrate de actualizar el texto con la dirección de contacto y la información de privacidad legalmente requerida en tu país.
