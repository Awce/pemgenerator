const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");

const app = express();
const port = 3000;

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
        if (err) {
          console.error(`Error al convertir el certificado: ${err.message}`);
          return res
            .status(500)
            .send("Error al convertir el archivo .cer a .pem.");
        }
        const certPEM = fs.readFileSync(certPEMPath, "utf8");
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
        res.send(`${keyPEM}`);
      });
    } else {
      res.status(400).send("Tipo de conversión no válido.");
    }
  }
);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}/`);
});
