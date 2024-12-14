const express = require('express');
const fs = require('fs').promises; // Usamos las funciones de promesas del módulo fs
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json()); //Middleware para parsear JSON
app.use(express.urlencoded({ extended: true })); // Middleware para parsear datos de formularios URL-encoded (opcional, pero útil)

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
      // Podría haber errores cafetería_suc
      // Equipo
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
        // Podría haber errores edificio
        // Equipo
        const sucursalesAsociadas = cafeteriaSucursales
          .filter(rel => rel.Id_Cafeteria === cafeteria.Id_Cafeteria)
          .map(rel => {
            const sucursal = sucursales.find(s => s.Id_Sucursal === rel.Id_Sucursal);
            return { 
              Id_Sucursal: rel.Id_Sucursal,
              Nombre: sucursal ? sucursal.Nombre : null,
              Horario: rel.Horario,
              Numero_Local: rel.Numero_Local,
              Edificio: sucursal.Edificio
            };
          });
  
        // Retornar cafetería con sus sucursales
        return {
          Id_Cafeteria: cafeteria.Id_Cafeteria,
          Nombre: cafeteria.Nombre,
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


//Crear usuario
app.route('/usuarios/crear').post(async (req, res) => {
  try {
    var data = req.body;

    //Leer el archivo
    const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
    const usuario = usuarios.find(usuario => usuario.Email === data.Email);
    if(!usuario){
      const id = usuarios[usuarios.length-1].Id_Usuario+1
      data.Id_Usuario = id; 
      usuarios.push(data); 
      const jsonString = JSON.stringify(usuarios); 
      fs.writeFile(path.join(nfsPath, 'TUsuario.json'), jsonString); 
      return res.status(200).json({ 
        success: true, 
        message: 'Usuario creado.',
        usuario: data.Id_Usuario
      });
    }else{
      return res.status(400).json({ 
        success: false, 
        message: 'Ya se ha utilizado ese correo.',
        usuario: null 
      });
    }
  } 
  catch (err) {
    console.error('Error al procesar los datos: ', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

//Login para la aplicación Android
app.route('/login').post(async (req, res) => {
  try {
    const { Correo, Contrasena } = req.body; //Correo y contraseña del cuerpo de la solicitud

    if(!Correo || !Contrasena) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere correo o contraseña.',
        usuario: null 
      });
    }

    //Leer el archivo de usuarios
    const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));

    //Buscar Correo y Contraseña
    const usuario = usuarios.find(usuario => usuario.Email === Correo);

    if(!usuario) {
      return res.status(404).json({
        success: false,
        message: 'El correo no está registrado.',
        usuario: null 
      });
    }
    
    if(usuario.Contrasena !== Contrasena) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña es incorrecta.',
        usuario: null 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Inicio de sesión correcto.',
      usuario: {
        Id_Usuario: usuario.Id_Usuario,
        Nombre: usuario.Nombre,
        Primer_Apellido: usuario.Primer_Apellido,
        Segundo_Apellido: usuario.Segundo_Apellido,
        Telefono: usuario.Telefono,
        Tipo: usuario.Tipo
      }
    });

  } 
  catch(err) {
    console.error('Error en el inicio de sesión: ' + err);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
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



// Endpoint para listar pedidos de cierto cliente
app.post('/pedidos', async (req, res) => {
  try {
    var data = req.body;
    console.log(data);

    // // Leer los archivos
    const pedidos = await readJsonFile(path.join(nfsPath, 'TPedido.json'));
    const cafeteria = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const sucursal = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const OrdenComida = await readJsonFile(path.join(nfsPath, 'TOrden_Comida.json'));
    const Comida = await readJsonFile(path.join(nfsPath, 'TComida.json'));

    // Filtrar pedidos del usuario
    // const pedido = pedidos.find(ped => ped.Id_Usuario == data.Id_Usuario);

    // // Añadir pedido del usuario


    const PedidosUsuario = pedidos
    .filter(rel => rel.Id_Usuario === data.Id_Usuario)
    .map(pedido => {
          const cafeteriaNom = cafeteria.find(caf => caf.Id_Cafeteria == pedido.Id_Cafeteria).Nombre;
          const sucursalNom = sucursal.find(suc => suc.Id_Sucursal == pedido.Id_Sucursal).Nombre;
          const Id_Comida = OrdenComida.find(orden => orden.Id_Orden == pedido.Orden).Id_Comida;
          const ComidaN = Comida.find(comida => comida.Id_Comida == Id_Comida).Nombre;
          const Precio = Comida.find(comida => comida.Id_Comida == Id_Comida).Precio;
        return {
          Cafeteria: cafeteriaNom,
          Sucursal: sucursalNom,
          Comida: ComidaN,
          Precio: Precio,
          ...pedido,
        };
    });
    console.log(PedidosUsuario);
    // Enviar respuesta
    res.json(PedidosUsuario);
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});


// Endpoint para listar pedidos del encargado
app.post('/pedidos/getEnc', async (req, res) => {
  try {
    var data = req.body;
    // console.log(data);

    // // Leer los archivos
    const UsuarioEncargado = await readJsonFile(path.join(nfsPath, 'TUsuario_Encar.json'));
    const Usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
    const pedidos = await readJsonFile(path.join(nfsPath, 'TPedido.json'));
    const cafeteria = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const sucursal = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const OrdenComida = await readJsonFile(path.join(nfsPath, 'TOrden_Comida.json'));
    const Comida = await readJsonFile(path.join(nfsPath, 'TComida.json'));

    const usuarioTipo = Usuarios.find(usu => usu.Id_Usuario == data.Id_Usuario).Tipo;
    if(!usuarioTipo) {
      console.log(usuarioTipo);
      return res.status(400).json({ 
        success: false, 
        message: 'El usuario no es Encargado',
        usuario: null 
      });
    }

    // Cafeteria y Sucursal
    const idCaySu = UsuarioEncargado.find(usu => usu.Id_Usuario == data.Id_Usuario);

    const PedidosUsuarioEnc = pedidos
    .filter(rel => rel.Id_Cafeteria === idCaySu.Id_Cafeteria && rel.Id_Sucursal === idCaySu.Id_Sucursal)
    .map(pedido => {
          const cafeteriaNom = cafeteria.find(caf => caf.Id_Cafeteria == pedido.Id_Cafeteria).Nombre;
          const sucursalNom = sucursal.find(suc => suc.Id_Sucursal == pedido.Id_Sucursal).Nombre;
          const Id_Comida = OrdenComida.find(orden => orden.Id_Orden == pedido.Orden).Id_Comida;
          const ComidaN = Comida.find(comida => comida.Id_Comida == Id_Comida).Nombre;
          const Precio = Comida.find(comida => comida.Id_Comida == Id_Comida).Precio;
          const NombreUsu = Usuarios.find(usuario => usuario.Id_Usuario == pedido.Id_Usuario).Nombre;
        return {
          NombreUsuario: NombreUsu,
          Cafeteria: cafeteriaNom,
          Sucursal: sucursalNom,
          Comida: ComidaN,
          Precio: Precio,
          ...pedido,
        };
    });

    // Enviar respuesta
    res.json(PedidosUsuarioEnc);
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});


app.post('/usuario/get', async (req, res) => {
  try {
    // Leer el archivo
    const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
    var data = req.body;
    for(usu of usuarios){
      if(usu.Email == data.Email){
        res.json(usu);
      } 
    }
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

app.post('/usuario/getsuyca', async (req, res) => {
  try {
    let id = ""; 
    // Leer el archivo
    const usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
    const encargado = await readJsonFile(path.join(nfsPath, 'TUsuario_Encar.json'));
    const cafeteria =  await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const sucursal =  await readJsonFile(path.join(nfsPath, 'TSucursal.json'));

    var data = req.body;
    for(usu of usuarios){
      if(usu.Email == data.Email){
        id = usu.Id_Usuario;
      } 
    }

    const enca = encargado.find(ing =>
      ing.Id_Usuario === id);
     
    const sucursalNombre = sucursal.find(ing =>
      ing.Id_Sucursal === enca.Id_Cafeteria);

    const cafeNombre = cafeteria.find(ing =>
      ing.Id_Cafeteria === enca.Id_Cafeteria);
  
    res.json({
      NombreCafe: cafeNombre.Nombre,
      Id_Cafeteria: cafeNombre.Id_Cafeteria,
      NombreSucu: sucursalNombre.Nombre,
      Id_Sucursal: sucursalNombre.Id_Sucursal
    });

  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }
});

app.post('/comidaid', async (req, res) => {
  try {
    // Leer el archivo
    const comidas = await readJsonFile(path.join(nfsPath, 'TComida.json'));
    const cafeteria = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const cafeteriaSucursal = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));
    const sucursal = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const ingredientes = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
    const comidaIngrediente = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));

    var data = req.body;

    const comida = comidas.find(ing =>
      ing.Id_Comida === Number(data.Id_Comida));
    const nombreCaf = cafeteria.find(ing => 
      ing.Id_Cafeteria === Number(comida.Id_Cafeteria)).Nombre;
    const sucuInfo = sucursal.find(ing =>
      ing.Id_Sucursal === Number(comida.Id_Sucursal));
    const cafesucu = cafeteriaSucursal.find(ing =>
      ing.Id_Sucursal === Number(comida.Id_Sucursal && ing.Id_Cafeteria === Number(comida.Id_Cafeteria)));

    const relacion = comidaIngrediente.filter(ing =>
      ing.Id_Comida === Number(data.Id_Comida));

    let ingre = Array(relacion.length); 
      for(let i=0; i<relacion.length; i++){
      ingre[i] = ingredientes.find(ing =>
        ing.Id_Ingrediente === relacion[i].Id_Ingrediente).Nombre;
    }


    res.json({
      Comida: comida,
      Ingredientes: ingre, 
      NombreCafeteria: nombreCaf, 
      NombreSucursal: sucuInfo.Nombre, 
      SucursalEdificio: sucuInfo.Edificio, 
      Local: cafesucu.Numero_Local, 
      Horario: cafesucu.Horario
    });

  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }}); 

  //Buscar cafeteria por id (para mostrar información)
  app.post('/cafeteriaid', async (req, res) => {
    try {
      // Cargar archivos JSON
      const cafeterias = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
      const cafeteriaSuc = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));
      const sucursales = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
  
      console.log('Request Body:', req.body);
      const { Id_Cafeteria } = req.body;
  
      // Validar que el ID de la cafetería sea proporcionado
      if (!Id_Cafeteria) {
        return res.status(400).json({ error: 'Se requiere el Id_Cafeteria en la solicitud' });
      }
  
      // Buscar la cafetería
      const cafeteria = cafeterias.find(caf => caf.Id_Cafeteria === Number(Id_Cafeteria));
      if (!cafeteria) {
        return res.status(404).json({ error: 'Cafetería no encontrada' });
      }
  
      // Obtener las sucursales asociadas a la cafetería
      const sucursalesDeCafeteria = cafeteriaSuc
        .filter(rel => rel.Id_Cafeteria === Number(Id_Cafeteria))
        .map(rel => {
          const sucursal = sucursales.find(s => s.Id_Sucursal === rel.Id_Sucursal);
          return {
            NombreSucursal: sucursal?.Nombre || 'Nombre no disponible',
            Horario: rel.Horario || 'Horario no disponible',
            NumeroLocal: rel.Numero_Local || 'Número de local no disponible',
            Edificio: sucursal?.Edificio || 'Edificio no disponible',
          };
        });
  
      // Validar si la cafetería tiene sucursales asociadas
      if (sucursalesDeCafeteria.length === 0) {
        return res.status(404).json({ 
          Nombre: cafeteria.Nombre,
          mensaje: 'La cafetería no tiene sucursales asociadas',
          Sucursales: [],
        });
      }
  
      // Construir y devolver la respuesta
      const response = {
        Nombre: cafeteria.Nombre,
        Sucursales: sucursalesDeCafeteria,
      };
  
      res.json(response);
    } catch (error) {
      console.error('Error al obtener detalles de la cafetería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  
  


  app.post('/pedido/entregado', async (req, res) => {
    try {

      // Leer el archivo
      const Pedidos = await readJsonFile(path.join(nfsPath, 'TPedido.json'));
      var data = req.body;

      console.log(data.Orden)
  
      for(let pedido of Pedidos){
        if(pedido.Orden == Number(data.Orden)){
          pedido.Pagado = "S"; 
        }
      }

      var result;
      const jsonString = JSON.stringify(Pedidos); 
      fs.writeFile(path.join(nfsPath, 'TPedido.json'), jsonString, err => {
        if (err) {
            console.log('Error writing file', err)
            result = false;
        } else {
            console.log('Successfully wrote file')
            result = true;
        }
      });
      
      res.json(result);
    } catch (err) {
      console.error('Error al procesar los datos:', err);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }}); 
  
  app.post('/pedido/cancelado', async (req, res) => {
    try {

      // Leer el archivo
      const Pedidos = await readJsonFile(path.join(nfsPath, 'TPedido.json'));
      var data = req.body;

      console.log(data.Orden)
  
      for(let pedido of Pedidos){
        if(pedido.Orden == Number(data.Orden)){
          pedido.Pagado = "C"; 
        }
      }

      var result;
      const jsonString = JSON.stringify(Pedidos); 
      fs.writeFile(path.join(nfsPath, 'TPedido.json'), jsonString, err => {
        if (err) {
            console.log('Error writing file', err)
            result = false;
        } else {
            console.log('Successfully wrote file')
            result = true;
        }
      });
      
      res.json(result);
    } catch (err) {
      console.error('Error al procesar los datos:', err);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }}); 

//Buscador
// app.get('/buscar', async (req, res) => {
//   try {
//     const { query, tipo } = req.query;
//     if (!query || !tipo) {
//       return res.status(400).json({ error: 'Los parámetros "query" y "tipo" son obligatorios.' });
//     }

//     let resultados = [];

//     // Cargar datos necesarios
//     const comidasData = await readJsonFile(path.join(nfsPath, 'TComida.json'));
//     const ingredientesData = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
//     const comidaIngreData = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));
//     const cafeteriasData = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
//     const sucursalesData = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
//     const cafeteriaSucData = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));

//     // Buscar según el tipo
//     switch (tipo.toLowerCase()) {
//       case 'comida':
//         const comidasEncontradas = comidasData.filter(comida =>
//           comida.Nombre.toLowerCase().includes(query.toLowerCase())
//         );

//         resultados = comidasEncontradas.map(comida => {
//           const ingredientesDeLaComida = comidaIngreData
//             .filter(rel => rel.Id_Comida === comida.Id_Comida)
//             .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);

//           const sucursalesDisponibles = cafeteriaSucData
//             .filter(rel => rel.Id_Cafeteria === comida.Id_Cafeteria && rel.Id_Sucursal === comida.Id_Sucursal)
//             .map(rel => {
//               const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
//               const cafeteria = cafeteriasData.find(c => c.Id_Cafeteria === rel.Id_Cafeteria);

//               return {
//                 Cafeteria: cafeteria?.Nombre || null,
//                 Sucursal: sucursal?.Nombre || null,
//               };
//             });

//           return {
//             ...comida,
//             Ingredientes: ingredientesDeLaComida,
//             Disponibilidad: sucursalesDisponibles,
//           };
//         });
//         break;

//       case 'ingrediente':
//         const ingredienteEncontrado = ingredientesData.find(ing =>
//           ing.Nombre.toLowerCase().includes(query.toLowerCase())
//         );

//         if (!ingredienteEncontrado) {
//           return res.status(404).json({ error: 'Ingrediente no encontrado.' });
//         }

//         const comidasConIngrediente = comidaIngreData
//           .filter(rel => rel.Id_Ingrediente === ingredienteEncontrado.Id_Ingrediente)
//           .map(rel => comidasData.find(comida => comida.Id_Comida === rel.Id_Comida));

//         resultados = comidasConIngrediente.map(comida => {
//           const ingredientesDeLaComida = comidaIngreData
//             .filter(rel => rel.Id_Comida === comida.Id_Comida)
//             .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);

//           const sucursalesDisponibles = cafeteriaSucData
//             .filter(rel => rel.Id_Cafeteria === comida.Id_Cafeteria && rel.Id_Sucursal === comida.Id_Sucursal)
//             .map(rel => {
//               const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
//               const cafeteria = cafeteriasData.find(c => c.Id_Cafeteria === rel.Id_Cafeteria);

//               return {
//                 Cafeteria: cafeteria?.Nombre || null,
//                 Sucursal: sucursal?.Nombre || null,
//               };
//             });

//           return {
//             ...comida,
//             Ingredientes: ingredientesDeLaComida,
//             Disponibilidad: sucursalesDisponibles,
//           };
//         });
//         break;

//       case 'cafeteria':
//         const cafeteriaEncontrada = cafeteriasData.find(caf =>
//           caf.Nombre.toLowerCase().includes(query.toLowerCase())
//         );

//         if (!cafeteriaEncontrada) {
//           return res.status(404).json({ error: 'Cafetería no encontrada.' });
//         }

//         const sucursalesDeLaCafeteria = cafeteriaSucData
//           .filter(rel => rel.Id_Cafeteria === cafeteriaEncontrada.Id_Cafeteria)
//           .map(rel => {
//             const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);

//             return {
//               Sucursal: sucursal?.Nombre || null,
//               Horario: rel.Horario || null,
//               NumeroLocal: rel.Numero_Local || null,
//               Edificio: rel.Edificio || null,
//             };
//           });

//         const comidasDeLaCafeteria = comidasData.filter(
//           comida => comida.Id_Cafeteria === cafeteriaEncontrada.Id_Cafeteria
//         );

//         resultados.push({
//           Cafeteria: cafeteriaEncontrada.Nombre,
//           Sucursales: sucursalesDeLaCafeteria,
//           Comidas: comidasDeLaCafeteria.map(comida => ({
//             ...comida,
//             Ingredientes: comidaIngreData
//               .filter(rel => rel.Id_Comida === comida.Id_Comida)
//               .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre),
//           })),
//         });
//         break;

//       default:
//         return res.status(400).json({ error: 'El tipo de búsqueda no es válido. Usa "comida", "cafeteria" o "ingrediente".' });
//     }

//     res.json(resultados);
//   } catch (err) {
//     console.error('Error en el buscador genérico:', err);
//     res.status(500).json({ error: 'Error al procesar la solicitud.' });
//   }
// });


//Endpoint del buscador
app.get('/buscar', async (req, res) => {
  try {
    const { query = '', tipo } = req.query;

    if (!tipo) {
      return res.status(400).json({ error: 'El parámetro "tipo" es obligatorio.' });
    }

    let resultados = [];
    const comidasData = await readJsonFile(path.join(nfsPath, 'TComida.json'));
    const ingredientesData = await readJsonFile(path.join(nfsPath, 'TIngredientes.json'));
    const comidaIngreData = await readJsonFile(path.join(nfsPath, 'TComida_Ingre.json'));
    const cafeteriasData = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const sucursalesData = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const cafeteriaSucData = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));

    switch (tipo.toLowerCase()) {
      case 'comida':
        const comidasFiltradas = query.trim()
          ? comidasData.filter(comida => comida.Nombre.toLowerCase().includes(query.toLowerCase()))
          : comidasData;

        resultados = comidasFiltradas.map(comida => {
          const ingredientesDeLaComida = comidaIngreData
            .filter(rel => rel.Id_Comida === comida.Id_Comida)
            .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);

          const sucursalesDisponibles = cafeteriaSucData
            .filter(rel => rel.Id_Cafeteria === comida.Id_Cafeteria)
            .map(rel => {
              const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
              const cafeteria = cafeteriasData.find(c => c.Id_Cafeteria === rel.Id_Cafeteria);
              return {
                Cafeteria: cafeteria?.Nombre || null,
                Sucursal: sucursal?.Nombre || null,
                NumeroLocal: rel.Numero_Local,
                Edificio: sucursal?.Edificio || null,
              };
            });

          return {
            ...comida,
            Ingredientes: ingredientesDeLaComida,
            Disponibilidad: sucursalesDisponibles,
            TiempoPrepa: comida.TiempoPrepa,
          };
        });
        break;

        case 'cafeteria':
          const queryLower = query.trim().toLowerCase();
        
          resultados = cafeteriasData.map(cafeteria => {
            const sucursalesDeCafeteria = cafeteriaSucData
              .filter(rel => rel.Id_Cafeteria === cafeteria.Id_Cafeteria)
              .map(rel => {
                const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
                return {
                  NombreSucursal: sucursal?.Nombre || null,
                  Horario: rel.Horario,
                  NumeroLocal: rel.Numero_Local,
                  Edificio: sucursal?.Edificio || null,
                };
              });
        
            return {
              Id_Cafeteria: cafeteria.Id_Cafeteria, // Agregar el ID de la cafetería
              Nombre: cafeteria.Nombre,
              Sucursales: sucursalesDeCafeteria,
            };
          });
        
          // Filtrar por cafetería o sucursal si la query está presente
          if (queryLower) {
            resultados = resultados.filter(item =>
              item.Nombre.toLowerCase().includes(queryLower) ||
              item.Sucursales.some(sucursal =>
                sucursal.NombreSucursal?.toLowerCase().includes(queryLower)
              )
            );
          }
        
          if (resultados.length === 0) {
            return res.status(404).json({ error: 'No se encontraron cafeterías o sucursales que coincidan con la búsqueda.' });
          }
          break;
        

      case 'ingrediente':
        const ingredientesFiltrados = query.trim()
          ? ingredientesData.filter(ing => ing.Nombre.toLowerCase().includes(query.toLowerCase()))
          : ingredientesData;

        if (ingredientesFiltrados.length === 0) {
          return res.status(404).json({ error: 'Ingrediente no encontrado.' });
        }

        resultados = ingredientesFiltrados.flatMap(ingrediente => {
          const comidasConIngrediente = comidaIngreData
            .filter(rel => rel.Id_Ingrediente === ingrediente.Id_Ingrediente)
            .map(rel => comidasData.find(comida => comida.Id_Comida === rel.Id_Comida));

          return comidasConIngrediente.filter(comida => comida).map(comida => {
            const ingredientesDeLaComida = comidaIngreData
              .filter(rel => rel.Id_Comida === comida.Id_Comida)
              .map(rel => ingredientesData.find(ing => ing.Id_Ingrediente === rel.Id_Ingrediente)?.Nombre);

            const sucursalesDisponibles = cafeteriaSucData
              .filter(rel => rel.Id_Cafeteria === comida.Id_Cafeteria)
              .map(rel => {
                const sucursal = sucursalesData.find(s => s.Id_Sucursal === rel.Id_Sucursal);
                const cafeteria = cafeteriasData.find(c => c.Id_Cafeteria === rel.Id_Cafeteria);
                return {
                  Cafeteria: cafeteria?.Nombre || null,
                  Sucursal: sucursal?.Nombre || null,
                  NumeroLocal: rel.Numero_Local,
                  Edificio: sucursal?.Edificio || null,
                };
              });

            return {
              Nombre: comida.Nombre,
              Precio: comida.Precio,
              Id_Comida: comida.Id_Comida,
              Ingredientes: ingredientesDeLaComida,
              Disponibilidad: sucursalesDisponibles,
              TiempoPrepa: comida.TiempoPrepa,
            };
          });
        });
        break;

      default:
        return res.status(400).json({ error: 'El tipo de búsqueda no es válido. Usa "comida", "cafeteria" o "ingrediente".' });
    }

    res.json(resultados);
  } catch (err) {
    console.error('Error en el buscador genérico:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
});

app.post('/cafeterias/sucursales', async (req, res) => {
  try {
    var data = req.body;
    // Leer el archivo
    const Sucursales = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const CafeteriaSuc = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));

    const CafeSucu = CafeteriaSuc
    .filter(rel => rel.Id_Cafeteria === Number(data.Id_Cafeteria))
    .map(cafe => {
          const NombreSucu = Sucursales.find(sucu => sucu.Id_Sucursal == cafe.Id_Sucursal).Nombre;
          const Edificio = Sucursales.find(sucu => sucu.Id_Sucursal == cafe.Id_Sucursal).Edificio;
        return {
          NombreSucursal: NombreSucu,
          Edificio: Edificio,
          ...cafe,
        };
    });
    

    // Enviar respuesta
    res.json(CafeSucu);
  } catch (err) {
    console.error('Error al procesar los datos:', err);
    res.status(500).json({ error: 'Error al cargar los datos' });
  }}); 

  app.post('/pedido/agregar', async (req, res) => {
    try {
      var data = req.body;

      // Leer el archivo
      const Pedidos = await readJsonFile(path.join(nfsPath, 'TPedido.json'));
      const TOrden_Comida = await readJsonFile(path.join(nfsPath, 'TOrden_Comida.json'));

      const idpedido = Pedidos[Pedidos.length-1].Orden+1; 
      data.Pedido.Orden = idpedido; 
      Pedidos.push(data.Pedido); 

      TOrden_Comida.push({Id_Orden: idpedido, Id_Comida: data.Comida.Id_Comida}); 

      
      let jsonString = JSON.stringify(Pedidos); 
      fs.writeFile(path.join(nfsPath, 'TPedido.json'), jsonString, err => {
        if (err) {
            console.log('Error writing file', err)
        } else {
        }
      }); 
      jsonString = JSON.stringify(TOrden_Comida); 
      fs.writeFile(path.join(nfsPath, 'TOrden_Comida.json'), jsonString, err => {
        if (err) {
            console.log('Error writing file', err)
        } else {
        }
      }); 

      res.json({Status: true});

    
    } catch (err) {
      console.error('Error al procesar los datos:', err);
      //console.log('Datos recibidos:', req.body);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }}); 

  app.post('/usuario/info', async (req, res) => {
    try {
      var data = req.body;

      // Leer el archivo
      const Usuarios = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));

      const usuario = Usuarios
      .filter(rel => rel.Id_Usuario !== Number(data.Id_Usuario))
      .map(usuario => {
            const NombreC = usuario.Nombre + " " + usuario.Primer_Apellido + " " + usuario.Segundo_Apellido;
          return {
            Nombre_Completo: NombreC, 
            Tipo: usuario.Tipo,
            Id_Usuario: usuario.Id_Usuario
          };
      });
    
      res.json(usuario);

    } catch (err) {
      console.error('Error al procesar los datos:', err);
      //console.log('Datos recibidos:', req.body);
      res.status(500).json({ error: 'Error al cargar los datos' });
    }}); 
  
app.get('/cafeusu/todos', async (req, res) => {
  try {
    // Leer el archivo
    const Cafeterias = await readJsonFile(path.join(nfsPath, 'TCafeteria.json'));
    const Sucursales = await readJsonFile(path.join(nfsPath, 'TSucursal.json'));
    const CafeSucu = await readJsonFile(path.join(nfsPath, 'TCafeteriaSuc.json'));


    const cafeteria = Cafeterias
    .map(cafeteria => {
        const cafesucu = CafeSucu
        .filter(rel => rel.Id_Cafeteria === cafeteria.Id_Cafeteria)
        .map(sucu => {
          const nombres = Sucursales.find(rel => rel.Id_Sucursal === sucu.Id_Sucursal); 
          return {
            Nombre_Sucursal: nombres.Nombre, 
            Id_Sucursal: nombres.Id_Sucursal
          }
        }); 
        return {
          Id_Cafeteria: cafeteria.Id_Cafeteria,
          Nombre_Cafeteria: cafeteria.Nombre, 
          Sucursales: cafesucu
        };
    });
  
    res.json(cafeteria);

  } catch (err) {
    console.error('Error al procesar los datos:', err);
    //console.log('Datos recibidos:', req.body);
    res.status(500).json({ error: 'Error al cargar los datos' });
}}); 
  
app.post('/usuario/cambiar', async (req, res) => {
  try {
    var data = req.body;

    // Leer el archivo
    const Usuario = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
    const TUsuario_Encar = await readJsonFile(path.join(nfsPath, 'TUsuario_Encar.json'));

    if(!Usuario.find(rel => rel.Id_Usuario === Number(data.Id_Usuario))){
      return res.status(400).json({ 
        success: false, 
        message: 'El Id_Usuario no coincide.',
      });
    }
    for(usu of Usuario){
      if(usu.Id_Usuario == Number(data.Id_Usuario)){
        usu.Tipo = data.Tipo; 
        if(data.Tipo === "Encargado"){
          if(TUsuario_Encar.find(rel => rel.Id_Usuario === Number(data.Id_Usuario))){
            return res.status(400).json({ 
              success: false, 
              message: 'El Id_Usuario no esta en encargados.',
            });
          }
          const jsonString = JSON.stringify(usuarios); 
          fs.writeFile(path.join(nfsPath, 'TUsuario.json'), jsonString); 
          return res.status(200).json({ 
            success: true, 
            message: 'Usuario creado.',
            usuario: data.Id_Usuario
          });
        }
      }
    }




  } catch (err) {
    console.error('Error al procesar los datos:', err);
    //console.log('Datos recibidos:', req.body);
    res.status(500).json({ error: 'Error al cargar los datos' });
}}); 
  
  
    
    app.get('/telefonos/encargados', async (req, res) => {
      try {
        const TUsuario = await readJsonFile(path.join(nfsPath, 'TUsuario.json'));
        const TUsuario_Encar = await readJsonFile(path.join(nfsPath, 'TUsuario_Encar.json'));
        
        const usuariosEncargados = TUsuario.filter(usuario => usuario.Tipo === "Encargado");
      
        const resultado = usuariosEncargados.map(encargado => {
          const datosEncargado = TUsuario_Encar.find(
            usuarioEncargado => usuarioEncargado.Id_Usuario === encargado.Id_Usuario
          );
  
          return {
           Id_Cafeteria: datosEncargado ? datosEncargado.Id_Cafeteria : null,
           Id_Sucursal: datosEncargado ? datosEncargado.Id_Sucursal : null,
           Telefono: encargado.Telefono,
          };
        });
    
        res.json(resultado);
      } 
      catch (err) {
        res.status(500).json({ 
            error: 'Error al cargar los datos de usuarios', 
            mensaje: err.message 
        });
      }
  });
  
// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});