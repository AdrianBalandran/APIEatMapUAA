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

bodyParser = require('body-parser');

// support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));



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

// Ruta para obtener comidas según ingredientes o nombres
app.get('/comidasxingredientes', async (req, res) => {
  try {
    // Obtener los parámetros de consulta
    const { ingredientes, nombre } = req.query;

    // Leer los archivos JSON
    const ingredientesData = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
    const comidaData = await readJsonFile(path.join(nfsPath, 'TComida.json'));
    const comidaIngreData = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));

    let comidasFiltradas = comidaData;

    // Filtrar por ingredientes si se proporciona el parámetro
    if (ingredientes) {
      const ingredientesIds = ingredientes.split(',').map(Number);

      // Filtrar las relaciones que coincidan con los ingredientes
      const comidasFiltradasIds = comidaIngreData
        .filter(rel => ingredientesIds.includes(rel.Id_Ingrediente))
        .map(rel => rel.Id_Comida);

      // Eliminar duplicados de IDs de comidas
      const comidasUnicasIds = [...new Set(comidasFiltradasIds)];

      // Filtrar las comidas por los IDs obtenidos
      comidasFiltradas = comidasFiltradas.filter(comida => comidasUnicasIds.includes(comida.Id_Comida));
    }

    // Filtrar por nombre de comida o ingrediente si se proporciona el parámetro
    if (nombre) {
      const nombreLower = nombre.toLowerCase();

      // Filtrar las comidas por nombre
      comidasFiltradas = comidasFiltradas.filter(comida =>
        comida.Nombre.toLowerCase().includes(nombreLower)
      );

      // Agregar las comidas relacionadas con los ingredientes que coincidan con el nombre
      const ingredientesCoincidentes = ingredientesData.filter(ing =>
        ing.Nombre.toLowerCase().includes(nombreLower)
      );

      if (ingredientesCoincidentes.length > 0) {
        const ingredienteIds = ingredientesCoincidentes.map(ing => ing.Id_Ingrediente);

        // Obtener IDs de comidas relacionadas con esos ingredientes
        const comidasPorIngredientes = comidaIngreData
          .filter(rel => ingredienteIds.includes(rel.Id_Ingrediente))
          .map(rel => rel.Id_Comida);

        // Combinar las comidas encontradas por nombre de comida e ingredientes
        const comidasPorNombreYIngredientes = comidaData.filter(comida =>
          comidasPorIngredientes.includes(comida.Id_Comida) || comidasFiltradas.some(c => c.Id_Comida === comida.Id_Comida)
        );

        comidasFiltradas = [...new Set(comidasPorNombreYIngredientes)];
      }
    }

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

  app.get('/buscar', async (req, res) => {
    try {
      const { query } = req.query; // Obtener término de búsqueda
      if (!query) {
        return res.status(400).json({ error: 'El parámetro de búsqueda es obligatorio.' });
      }
      
      const menus = await readJsonFile(path.join(nfsPath, 'TComida.json'));
      const ingredientes = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
      const cafeterias = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
  
      // Filtrar datos según el término
      const resultadoMenus = menus.filter(menu => 
        menu.Nombre.toLowerCase().includes(query.toLowerCase())
      );
      const resultadoIngredientes = ingredientes.filter(ing => 
        ing.Nombre.toLowerCase().includes(query.toLowerCase())
      );
      const resultadoCafeterias = cafeterias.filter(caf => 
        caf.Nombre.toLowerCase().includes(query.toLowerCase())
      );
  
      res.json({
        menus: resultadoMenus,
        ingredientes: resultadoIngredientes,
        cafeterias: resultadoCafeterias,
      });
    } catch (err) {
      console.error('Error procesando búsqueda:', err);
      res.status(500).json({ error: 'Error al realizar la búsqueda.' });
    }
  });

  // Endpoint para buscar comida por nombre
app.get('/buscar-comida', async (req, res) => {
  try {
    const { nombre } = req.query; // Obtener el nombre de la comida
    if (!nombre) {
      return res.status(400).json({ error: 'El parámetro "nombre" es obligatorio.' });
    }

    // Leer los archivos necesarios
    const comidaData = await readJsonFile(path.join(nfsPath, 'TComida.json'));
    const ingredientesData = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
    const comidaIngreData = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));

    // Filtrar comidas por nombre
    const comidasEncontradas = comidaData.filter(comida =>
      comida.Nombre.toLowerCase().includes(nombre.toLowerCase())
    );

    // Añadir ingredientes a cada comida encontrada
    const comidasConIngredientes = comidasEncontradas.map(comida => {
      const ingredientesDeLaComida = comidaIngreData
        .filter(rel => rel.Id_Comida === comida.Id_Comida)
        .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);

      return {
        ...comida,
        Ingredientes: ingredientesDeLaComida,
      };
    });

    res.json(comidasConIngredientes);
  } catch (err) {
    console.error('Error al buscar comida:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

// Endpoint para buscar cafetería por nombre
app.get('/buscar-cafeteria', async (req, res) => {
  try {
    const { nombre } = req.query; // Obtener el nombre de la cafetería
    if (!nombre) {
      return res.status(400).json({ error: 'El parámetro "nombre" es obligatorio.' });
    }

    // Leer los archivos necesarios
    const cafeteriasData = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const sucursalesData = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const cafeteriaSucData = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));

    // Filtrar cafeterías por nombre
    const cafeteriasEncontradas = cafeteriasData.filter(cafeteria =>
      cafeteria.Nombre.toLowerCase().includes(nombre.toLowerCase())
    );

    // Añadir sucursales a cada cafetería encontrada
    const cafeteriasConSucursales = cafeteriasEncontradas.map(cafeteria => {
      const sucursalesAsociadas = cafeteriaSucData
        .filter(rel => rel.Id_Cafeteria === cafeteria.Id_Cafeteria)
        .map(rel => {
          const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
          return {
            Id_Sucursal: rel.Id_Sucursal,
            Nombre: sucursal ? sucursal.Nombre : null,
            Horario: rel.Horario,
            Numero_Local: rel.Numero_Local,
          };
        });

      return {
        ...cafeteria,
        Sucursales: sucursalesAsociadas,
      };
    });

    res.json(cafeteriasConSucursales);
  } catch (err) {
    console.error('Error al buscar cafetería:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

// Endpoint para buscar cafetería por nombre
app.post('/usuario/nuevo', async (req, res) => {
  var data = req.body;
  const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
  usuarios.push(data); 

  const jsonString = JSON.stringify(usuarios); 
  fs.writeFile(path.join(nfsPath, 'TUsuario.json'), jsonString, err => {
    if (err) {
        console.log('Error writing file', err)
    } else {
        console.log('Successfully wrote file')
    }
})
});

  
  
  

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
