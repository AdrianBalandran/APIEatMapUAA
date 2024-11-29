const express = require('express');
const fs = require('fs').promises; // Usamos las funciones de promesas del módulo fs
const path = require('path');

const app = express();
const PORT = 3000;

// Ruta al directorio NFS
//const nfsPath = '\\\\192.168.100.25\\data\\menus';
const nfsPath = path.join(__dirname, 'prueba_nfs');

const cors = require('cors');
app.use(cors());

// Función para leer un archivo JSON
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error al leer el archivo ${filePath}:`, err);
    throw err;
  }
}

// Endpoint para listar los menús con su sucursal
app.get('/menus', async (req, res) => {
  try {
    // Leer los archivos
    const sucursales = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const menus = await readJsonFile(path.join(nfsPath, 'TComida.json'));

    // Combinar los datos usando las llaves foráneas
    const menusConSucursal = menus.map(menu => {
      const sucursal = sucursales.find(suc => suc.Id_Cafeteria === menu.Cafeteria_Sucursal);
      return {
        ...menu,
        sucursal: sucursal ? sucursal.Nombre : null // Añadir el nombre de la sucursal
      };
    });

    res.json(menusConSucursal);
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

// Endpoint para listar cafeterías con sus sucursales
app.get('/cafeterias', async (req, res) => {
    try {
      // Leer los archivos
      const cafeterias = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
      const sucursales = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
      const cafeteriaSucursales = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));
  
      // Combinar datos
      const resultado = cafeterias.map(cafeteria => {
        // Encontrar las sucursales asociadas a esta cafetería
        const sucursalesAsociadas = cafeteriaSucursales
          .filter(rel => rel.Id_Cafeteria === cafeteria.Id_Cafeteria)
          .map(rel => {
            const sucursal = sucursales.find(s => s.Id_Sucursal === rel.Id_Sucursal);
            return {
              Id_Sucursal: rel.Id_Sucursal,
              Nombre: sucursal ? sucursal.Nombre : null,
              Horario: rel.Horario,
              Numero_Local: rel.Numero_Local
            };
          });
  
        // Retornar cafetería con sus sucursales
        return {
          Id_Cafeteria: cafeteria.Id_Cafeteria,
          Nombre: cafeteria.Nombre,
          Edificio: cafeteria.Edificio,
          Sucursales: sucursalesAsociadas
        };
      });
  
      // Enviar respuesta
      res.json(resultado);
    } catch (err) {
      console.error('Error al procesar los datos:', err);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }
  });

  // Ruta para obtener comidas según ingredientes
app.get('/comidasxingredientes', async (req, res) => {
    try {
      // Obtener el parámetro de consulta (lista de ingredientes)
      const { ingredientes } = req.query; // Ejemplo: ?ingredientes=1,4
      if (!ingredientes) {
        return res.status(400).json({ error: "Se requiere una lista de ingredientes." });
      }
  
      // Convertir los ingredientes a un array de números
      const ingredientesIds = ingredientes.split(',').map(Number);
  
      // Leer los archivos JSON
      const ingredientesData = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
      const comidaData = await readJsonFile(path.join(nfsPath, 'TComida.json'));
      const comidaIngreData = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));
  
      // Filtrar las relaciones que coincidan con los ingredientes
      const comidasFiltradasIds = comidaIngreData
        .filter(rel => ingredientesIds.includes(rel.Id_Ingrediente))
        .map(rel => rel.Id_Comida);
  
      // Eliminar duplicados de IDs de comidas
      const comidasUnicasIds = [...new Set(comidasFiltradasIds)];
  
      // Obtener los datos completos de las comidas
      const comidasFiltradas = comidaData.filter(comida => comidasUnicasIds.includes(comida.Id_Comida));
  
      // Añadir los nombres de los ingredientes usados a cada comida
      const comidasConIngredientes = comidasFiltradas.map(comida => {
        const ingredientesDeLaComida = comidaIngreData
          .filter(rel => rel.Id_Comida === comida.Id_Comida)
          .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);
  
        return {
          ...comida,
          Ingredientes: ingredientesDeLaComida
        };
      });
  
      // Responder con las comidas filtradas
      res.json(comidasConIngredientes);
    } catch (err) {
      console.error('Error obteniendo las comidas:', err);
      res.status(500).json({ error: "Error al procesar la solicitud." });
    }
  });


  app.get('/usuarios', async (req, res) => {
    try {
      // Leer el archivo
      const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
      
      res.json(usuarios);
    } catch (err) {
      console.error('Error al procesar los datos:', err);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }
  });
  

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
