# PEM Generator API

API para convertir archivos `.cer` y `.key` a `.pem` y generar un archivo PEM combinado, ideal para integrarse con FileMaker u otros sistemas.

---

## Características

- Convierte archivos `.cer` (DER) a `.pem`.
- Convierte archivos `.key` (DER) a `.pem` con contraseña opcional.
- Endpoint `/generate` para envío base64 + contraseña y respuesta PEM.
- Limpieza automática de archivos temporales.
- Fácil integración con FileMaker usando JSON.

---

## Requisitos

- Node.js v14 o superior
- OpenSSL instalado y en el PATH del sistema
- Yarn (opcional, para manejo de dependencias)

---

## Instalación

```bash
git clone "https://github.com/Awce/pemgenerator"
cd pemgenerator
yarn install
