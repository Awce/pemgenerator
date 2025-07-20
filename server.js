const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

const app = express();
const port = 3000;

// JSON parser con manejo de errores
app.use((req, res, next) => {
  express.json({ limit: "10mb" })(req, res, (err) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: 'Invalid JSON format. Please ensure your JSON data is properly formatted and contains no unescaped control characters.'
      });
    }
    next(err);
  });
});

// Configuración multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("temp")) fs.mkdirSync("temp");

// Función para borrar archivos si existen
function safeDelete(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn(`No se pudo borrar ${filePath}:`, e.message);
    }
  }
}

// Servir HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Ruta upload - recibe archivos físicos
app.post(
    "/upload",
    upload.fields([{ name: "cerFile" }, { name: "keyFile" }]),
    (req, res) => {
      const conversionType = req.body.conversionType;
      const password = req.body.password || "";

      if (conversionType === "cer") {
        if (!req.files.cerFile || req.files.cerFile.length === 0) {
          return res.status(400).send("Archivo .cer no enviado");
        }
        const cerFilePath = req.files.cerFile[0].path;
        const certPEMPath = path.join("uploads", "certificado.pem");
        const convertCertCommand = `openssl x509 -inform DER -in "${cerFilePath}" -out "${certPEMPath}"`;

        exec(convertCertCommand, (err) => {
          safeDelete(cerFilePath);
          if (err) {
            safeDelete(certPEMPath);
            console.error(`Error al convertir el certificado: ${err.message}`);
            return res.status(500).send("Error al convertir el archivo .cer a .pem.");
          }
          const certPEM = fs.readFileSync(certPEMPath, "utf8");
          safeDelete(certPEMPath);
          res.send(certPEM);
        });
      } else if (conversionType === "key") {
        if (!req.files.keyFile || req.files.keyFile.length === 0) {
          return res.status(400).send("Archivo .key no enviado");
        }
        const keyFilePath = req.files.keyFile[0].path;
        const keyPEMPath = path.join("uploads", "clave.pem");
        const convertKeyCommand = password
            ? `openssl pkcs8 -inform DER -in "${keyFilePath}" -out "${keyPEMPath}" -passin pass:${password}`
            : `openssl pkcs8 -inform DER -in "${keyFilePath}" -out "${keyPEMPath}" -nocrypt`;

        exec(convertKeyCommand, (err) => {
          safeDelete(keyFilePath);
          if (err) {
            safeDelete(keyPEMPath);
            console.error(`Error al convertir la clave: ${err.message}`);
            return res.status(500).send("Error al convertir el archivo .key a .pem. Verifica la contraseña.");
          }
          const keyPEM = fs.readFileSync(keyPEMPath, "utf8");
          safeDelete(keyPEMPath);
          res.send(keyPEM);
        });
      } else {
        res.status(400).send("Tipo de conversión no válido.");
      }
    }
);

// Ruta generate - recibe base64 JSON
app.post("/generate", async (req, res) => {
  try {
    let { cerBase64, keyBase64, password } = req.body;
    if (!cerBase64 || !keyBase64 || !password) {
      return res.status(400).json({ error: "Faltan datos necesarios: cerBase64, keyBase64 o password" });
    }

    cerBase64 = cerBase64.replace(/\s/g, '');
    keyBase64 = keyBase64.replace(/\s/g, '');

    const tempDir = "./temp";

    const cerPath = path.join(tempDir, "cert.cer");
    const keyPath = path.join(tempDir, "private.key");
    const decryptedKeyPath = path.join(tempDir, "decrypted.key");
    const certPemPath = path.join(tempDir, "cert.pem");
    const pemPath = path.join(tempDir, "final.pem");

    fs.writeFileSync(cerPath, Buffer.from(cerBase64, "base64"));
    fs.writeFileSync(keyPath, Buffer.from(keyBase64, "base64"));

    const command = `openssl pkcs8 -inform DER -in "${keyPath}" -passin pass:${password} -out "${decryptedKeyPath}" && openssl x509 -inform DER -in "${cerPath}" -out "${certPemPath}" && cat "${certPemPath}" "${decryptedKeyPath}" > "${pemPath}"`;

    exec(command, (error) => {
      if (error) {
        safeDelete(cerPath);
        safeDelete(keyPath);
        safeDelete(decryptedKeyPath);
        safeDelete(certPemPath);
        safeDelete(pemPath);
        console.error("Error al generar PEM:", error);
        return res.status(500).json({ error: "Error al generar PEM" });
      }

      const pemContent = fs.readFileSync(pemPath, "utf8");

      // Limpieza archivos temporales
      [cerPath, keyPath, decryptedKeyPath, certPemPath, pemPath].forEach(safeDelete);

      return res.json({ pem: pemContent });
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}/`);
});
