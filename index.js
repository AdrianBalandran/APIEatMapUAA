const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

const nfsPath = '\\\\192.168.100.25\\data\\menus';


// Ruta para listar archivos
app.get('/files', (req, res) => {
    fs.readdir(nfsPath, (err, files) => {
        if (err) {
            res.status(500).json({ error: 'Error leyendo el directorio NFS' });
            return;
        }
        res.json({ files });
    });
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
