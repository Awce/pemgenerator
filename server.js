const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

const app = express();
const port = 3000;

app.use(express.json({ limit: "10mb" }));

// Configuración de almacenamiento de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Crear la carpeta 'uploads' si no existe
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Función auxiliar para eliminar archivos si existen
function safeDelete(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Ruta para servir el archivo HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Ruta para manejar la carga de archivos
app.post(
  "/upload",
  upload.fields([{ name: "cerFile" }, { name: "keyFile" }]),
  (req, res) => {
    const conversionType = req.body.conversionType;
    const password = req.body.password || "";

    if (conversionType === "cer") {
      // Convertir archivo .cer a .pem
      const cerFilePath = req.files.cerFile[0].path;
      const certPEMPath = path.join("uploads", "certificado.pem");
      const convertCertCommand = `openssl x509 -inform DER -in "${cerFilePath}" -out "${certPEMPath}"`;

      exec(convertCertCommand, (err) => {

        safeDelete(cerFilePath);

        if (err) {
          console.error(`Error al convertir el certificado: ${err.message}`);
          return res
            .status(500)
            .send("Error al convertir el archivo .cer a .pem.");
        }
        const certPEM = fs.readFileSync(certPEMPath, "utf8");
        safeDelete(certPEMPath);
        res.send(`${certPEM}`);
      });
    } else if (conversionType === "key") {
      // Convertir archivo .key a .pem
      const keyFilePath = req.files.keyFile[0].path;
      const keyPEMPath = path.join("uploads", "clave.pem");
      const convertKeyCommand = password
        ? `openssl pkcs8 -inform DER -in "${keyFilePath}" -out "${keyPEMPath}" -passin pass:${password}`
        : `openssl pkcs8 -inform DER -in "${keyFilePath}" -out "${keyPEMPath}" -nocrypt`;

      exec(convertKeyCommand, (err) => {
        if (err) {
          console.error(`Error al convertir la clave: ${err.message}`);
          return res
            .status(500)
            .send(
              "Error al convertir el archivo .key a .pem. Verifica la contraseña."
            );
        }
        const keyPEM = fs.readFileSync(keyPEMPath, "utf8");
        safeDelete(keyPEMPath);
        res.send(`${keyPEM}`);
      });
    } else {
      res.status(400).send("Tipo de conversión no válido.");
    }
  }
);

// ruta para manejar peticiones del generador
app.post("/generate", async (req, res) => {
  try {
    const { cerBase64, keyBase64, password } = req.body;

    const tempDir = "./temp";
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const cerPath = path.join(tempDir, "cert.cer");
    const keyPath = path.join(tempDir, "private.key");
    const pemPath = path.join(tempDir, "final.pem");

    fs.writeFileSync(cerPath, Buffer.from(cerBase64, "base64"));
    fs.writeFileSync(keyPath, Buffer.from(keyBase64, "base64"));

    const command = `openssl pkcs8 -inform DER -in ${keyPath} -passin pass:${password} -out temp/decrypted.key && openssl x509 -inform DER -in ${cerPath} -out temp/cert.pem && cat temp/cert.pem temp/decrypted.key > ${pemPath}`;

    exec(command, (error) => {
      if (error) {
        console.error("Error al generar PEM:", error);
        return res.status(500).json({ error: "Error al generar PEM" });
      }

      const pemContent = fs.readFileSync(pemPath, "utf8");
      return res.json({ pem: pemContent });
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}/`);
});
