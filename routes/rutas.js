const fs = require('fs').promises;
const path = require('path');

const nfsPath = 'Y:\\data\\menus'; // Ruta del directorio NFS

// Función para leer un archivo JSON
async function readJsonFile(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

// Endpoint para obtener menús con sus categorías
app.get('/menus', async (req, res) => {
  try {
    // Leer los archivos
    const sucursales = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const menus = await readJsonFile(path.join(nfsPath, 'TComida.json'));

    // Combinar los datos usando las llaves foráneas
    const menusConSucursal = menus.map(menu => {
      const sucursal = sucursales.find(cat => cat.Id_Comida === menu.Cafeteria_Sucursal);
      return {
        ...menu,
        sucursal: sucursal ? sucursal.Nombre : null // Añadir el nombre de la sucursal
      };
    });

    res.json(menusConSucursal);
  } catch (err) {
    console.error('Error leyendo los archivos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

app.get('/usuarios', async (req, res) => {
  try {
    // Leer los archivos
    const sucursales = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const menus = await readJsonFile(path.join(nfsPath, 'TComida.json'));

    // Combinar los datos usando las llaves foráneas
    const menusConSucursal = menus.map(menu => {
      const sucursal = sucursales.find(cat => cat.Id_Comida === menu.Cafeteria_Sucursal);
      return {
        ...menu,
        sucursal: sucursal ? sucursal.Nombre : null // Añadir el nombre de la sucursal
      };
    });

    res.json(menusConSucursal);
  } 
  catch (err) {
    console.error('Error leyendo los archivos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});
