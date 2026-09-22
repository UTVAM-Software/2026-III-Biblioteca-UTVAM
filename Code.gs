// ============================================================
// CONFIGURACIÓN DEL CLIENTE — EDITA SOLO ESTA SECCIÓN
// ============================================================
const CONFIG = {
  nombreSistema: "Sistema de Control de Inventario",
  nombreCorto: "INVENTARIO MAWL",

  // ID de la hoja de cálculo del cliente.
  // En Google Sheets: abre la hoja y copia el ID de la URL.
  spreadsheetId: "1jvksiXb20MfkhVnEedHV7kwK36HzW88nNKeBnxQSTYc",

  hojas: {
    productos: "Productos",
    movimientos: "Movimientos",
    unidades: "Unidades",
    grupos: "Grupos"
  },

  carpetaReportes: "Reportes Inventario",

  colores: {
    principal: "#2E86AB",
    secundario: "#1C5F7B",
    acento: "#5DADE2",
    fondo: "#2222ff",
    fondoContenido: "#FAFBFC",
    borde: "#E5F2F7",
    tarjeta: "#F0F8FC"
  }
};

// No necesitas editar estas líneas.
const SPREADSHEET_ID = CONFIG.spreadsheetId;
const HOJA_PRODUCTOS = CONFIG.hojas.productos;
const HOJA_MOVIMIENTOS = CONFIG.hojas.movimientos;
const HOJA_UNIDADES = CONFIG.hojas.unidades;
const HOJA_GRUPOS = CONFIG.hojas.grupos;

const TIPOS_MOVIMIENTO = {
  INGRESO: "INGRESO",
  SALIDA: "SALIDA", 
  AJUSTE_POSITIVO: "AJUSTE_POSITIVO",
  AJUSTE_NEGATIVO: "AJUSTE_NEGATIVO",
  AJUSTE: "AJUSTE"
};

function obtenerConfiguracion() {
  return {
    nombreSistema: CONFIG.nombreSistema,
    nombreCorto: CONFIG.nombreCorto,
    colores: CONFIG.colores
  };
}

function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile("index")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setTitle(CONFIG.nombreSistema);
  } catch (error) {
    return HtmlService.createHtmlOutput(`
      <div style="padding: 20px; font-family: Arial; text-align: center;">
        <h2 style="color: #dc3545;">Error del Sistema</h2>
        <p>No se pudo cargar la aplicación: ${error.message}</p>
        <button onclick="window.location.reload()">Reintentar</button>
      </div>
    `);
  }
}

function registrarProducto(producto) {
  try {
    if (!producto || !producto.codigo || !producto.nombre) {
      return "Datos del producto incompletos. Código y nombre son obligatorios.";
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    
    if (!sheet) {
      throw new Error(`La hoja '${HOJA_PRODUCTOS}' no existe. Inicialice el sistema primero.`);
    }
    
    if (!sheet.getLastRow()) {
      sheet.getRange(1, 1, 1, 6).setValues([["Código", "Nombre", "Unidad", "Grupo", "Stock Mínimo", "Fecha Creación"]]);
      sheet.getRange(1, 1, 1, 6).setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
    }
    
    const datos = sheet.getDataRange().getValues();
    const codigoNormalizado = producto.codigo.toString().trim().toUpperCase();
    
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] && datos[i][0].toString().trim().toUpperCase() === codigoNormalizado) {
        return "Ya existe un producto con este código.";
      }
    }
    
    const nombre = producto.nombre.toString().trim();
    const unidad = producto.unidad || "Unidades";
    const grupo = producto.grupo || "General";
    const stockMin = Math.max(0, parseInt(producto.stockMin) || 0);
    
    if (nombre.length < 2) {
      return "El nombre del producto debe tener al menos 2 caracteres.";
    }
    
    sheet.appendRow([
      codigoNormalizado, 
      nombre, 
      unidad, 
      grupo, 
      stockMin,
      new Date()
    ]);
    
    return "Producto registrado correctamente.";
  } catch (error) {
    console.error("Error en registrarProducto:", error);
    return `Error al registrar producto: ${error.message}`;
  }
}

function registrarMovimiento(mov) {
  try {
    if (!mov || !mov.codigo || !mov.fecha || !mov.tipo || !mov.cantidad) {
      return "Datos del movimiento incompletos.";
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    const movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    
    if (!prodSheet || !movSheet) {
      throw new Error("Las hojas del sistema no existen. Inicialice el sistema primero.");
    }
    
    if (!movSheet.getLastRow()) {
      movSheet.getRange(1, 1, 1, 8).setValues([["Código", "Fecha", "Tipo", "Cantidad", "Usuario", "Timestamp", "Observaciones", "Stock Resultante"]]);
      movSheet.getRange(1, 1, 1, 8).setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
    }
    
    const codigoNormalizado = mov.codigo.toString().trim().toUpperCase();
    const cantidad = parseFloat(mov.cantidad);
    const tipo = mov.tipo.toString().toUpperCase();
    
    if (cantidad <= 0) {
      return "La cantidad debe ser mayor a 0.";
    }
    
    if (!Object.values(TIPOS_MOVIMIENTO).includes(tipo)) {
      return `Tipo de movimiento inválido: ${tipo}`;
    }
    
    const productos = prodSheet.getDataRange().getValues();
    let productoExiste = false;
    let nombreProducto = "";
    
    for (let i = 1; i < productos.length; i++) {
      if (productos[i][0] && productos[i][0].toString().trim().toUpperCase() === codigoNormalizado) {
        productoExiste = true;
        nombreProducto = productos[i][1];
        break;
      }
    }
    
    if (!productoExiste) {
      return "El producto no existe. Regístrelo primero.";
    }
    
    const stockActual = calcularStock(codigoNormalizado);
    
    if ((tipo === TIPOS_MOVIMIENTO.SALIDA || tipo === TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO) && stockActual < cantidad) {
      return `Stock insuficiente. Disponible: ${stockActual}, Solicitado: ${cantidad}`;
    }
    
    let stockResultante = stockActual;
    switch (tipo) {
      case TIPOS_MOVIMIENTO.INGRESO:
      case TIPOS_MOVIMIENTO.AJUSTE_POSITIVO:
        stockResultante += cantidad;
        break;
      case TIPOS_MOVIMIENTO.SALIDA:
      case TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO:
        stockResultante -= cantidad;
        break;
      case TIPOS_MOVIMIENTO.AJUSTE:
        stockResultante += cantidad;
        break;
    }
    
    stockResultante = Math.max(0, stockResultante);
    
    // Crear fecha correctamente para evitar problemas de zona horaria
    let fechaMovimiento;
    if (typeof mov.fecha === 'string') {
      // Si viene como string YYYY-MM-DD, crear la fecha sin zona horaria
      const partesFecha = mov.fecha.split('-');
      fechaMovimiento = new Date(parseInt(partesFecha[0]), parseInt(partesFecha[1]) - 1, parseInt(partesFecha[2]), 12, 0, 0);
    } else {
      fechaMovimiento = new Date(mov.fecha);
    }
    
    movSheet.appendRow([
      codigoNormalizado, 
      fechaMovimiento, 
      tipo, 
      cantidad,
      Session.getActiveUser().getEmail() || "Sistema",
      new Date(),
      mov.observaciones || "",
      stockResultante
    ]);
    
    return "Movimiento registrado correctamente.";
  } catch (error) {
    console.error("Error en registrarMovimiento:", error);
    return `Error al registrar movimiento: ${error.message}`;
  }
}

function buscarProductoPorCodigo(codigo) {
  try {
    if (!codigo || codigo.trim().length < 1) {
      return [];
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    
    if (!sheet) {
      return [];
    }
    
    const datos = sheet.getDataRange().getValues();
    
    if (datos.length <= 1) {
      return [];
    }
    
    const textoBusqueda = codigo.toString().toUpperCase().trim();
    const encontrados = [];
    
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      if (fila[0] && fila[0].toString().toUpperCase().startsWith(textoBusqueda)) {
        encontrados.push({
          codigo: fila[0],
          nombre: fila[1],
          unidad: fila[2] || "Unidades",
          grupo: fila[3] || "General"
        });
      }
    }
    
    return encontrados.slice(0, 10);
  } catch (error) {
    console.error("Error en buscarProductoPorCodigo:", error);
    return [];
  }
}

function buscarProducto(texto) {
  try {
    if (!texto || texto.trim().length < 1) {
      return [];
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    
    if (!sheet) {
      throw new Error(`La hoja '${HOJA_PRODUCTOS}' no existe.`);
    }
    
    const datos = sheet.getDataRange().getValues();
    
    if (datos.length <= 1) {
      return [];
    }
    
    const textoBusqueda = texto.toString().toLowerCase().trim();
    const encontrados = [];
    
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      if (fila[0] && (
        fila[0].toString().toLowerCase().includes(textoBusqueda) ||
        fila[1].toString().toLowerCase().includes(textoBusqueda) ||
        (fila[3] && fila[3].toString().toLowerCase().includes(textoBusqueda))
      )) {
        const stock = calcularStock(fila[0]);
        encontrados.push([
          fila[0],
          fila[1],
          fila[2],
          fila[3],
          fila[4] || 0,
          stock
        ]);
      }
    }
    
    return encontrados.sort((a, b) => a[1].localeCompare(b[1]));
  } catch (error) {
    console.error("Error en buscarProducto:", error);
    return [];
  }
}

function obtenerStock() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    
    if (!prodSheet) {
      throw new Error(`La hoja '${HOJA_PRODUCTOS}' no existe.`);
    }
    
    const productos = prodSheet.getDataRange().getValues();
    
    if (productos.length <= 1) {
      return [];
    }
    
    const stock = [];
    
    for (let i = 1; i < productos.length; i++) {
      const [codigo, nombre, unidad, grupo, stockMin] = productos[i];
      if (codigo && nombre) {
        const cantidad = calcularStock(codigo);
        stock.push({
          codigo: codigo.toString(), 
          nombre: nombre.toString(), 
          unidad: unidad || "Unidades", 
          grupo: grupo || "General", 
          stockMin: Math.max(0, parseInt(stockMin) || 0),
          cantidad: cantidad
        });
      }
    }
    
    return stock.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch (error) {
    console.error("Error en obtenerStock:", error);
    return [];
  }
}

function calcularStock(codigo) {
  try {
    if (!codigo) return 0;
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    
    if (!movSheet) {
      return 0;
    }
    
    const movimientos = movSheet.getDataRange().getValues();
    let cantidad = 0;
    const codigoNormalizado = codigo.toString().trim().toUpperCase();
    
    for (let i = 1; i < movimientos.length; i++) {
      const [cod, fecha, tipo, cant] = movimientos[i];
      if (cod && cod.toString().trim().toUpperCase() === codigoNormalizado) {
        const valor = parseFloat(cant) || 0;
        const tipoMovimiento = tipo.toString().toUpperCase();
        
        switch (tipoMovimiento) {
          case TIPOS_MOVIMIENTO.INGRESO:
          case TIPOS_MOVIMIENTO.AJUSTE_POSITIVO:
            cantidad += valor;
            break;
          case TIPOS_MOVIMIENTO.SALIDA:
          case TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO:
            cantidad -= valor;
            break;
          case TIPOS_MOVIMIENTO.AJUSTE:
            cantidad += valor;
            break;
        }
      }
    }
    
    return Math.max(0, Math.round(cantidad * 100) / 100);
  } catch (error) {
    console.error("Error en calcularStock:", error);
    return 0;
  }
}

function obtenerHistorial(filtros) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    const prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    
    if (!movSheet || !prodSheet) {
      throw new Error("Las hojas del sistema no existen.");
    }
    
    const movimientos = movSheet.getDataRange().getValues();
    const productos = prodSheet.getDataRange().getValues();
    
    const prodMap = {};
    for (let i = 1; i < productos.length; i++) {
      if (productos[i][0]) {
        prodMap[productos[i][0].toString().toUpperCase()] = productos[i][1];
      }
    }
    
    const fechaDesde = new Date(filtros.fechaDesde + 'T00:00:00');
    const fechaHasta = new Date(filtros.fechaHasta + 'T23:59:59');
    
    if (fechaDesde > fechaHasta) {
      throw new Error("La fecha 'desde' no puede ser posterior a la fecha 'hasta'");
    }
    
    const resultado = [];
    
    for (let i = 1; i < movimientos.length; i++) {
      const mov = movimientos[i];
      if (!mov[0] || !mov[1]) continue;
      
      try {
        const fechaMov = new Date(mov[1]);
        const tipoMov = mov[2] ? mov[2].toString().toUpperCase() : "";
        
        if (fechaMov >= fechaDesde && fechaMov <= fechaHasta) {
          if (!filtros.tipo || tipoMov === filtros.tipo.toUpperCase()) {
            const codigoProducto = mov[0].toString().toUpperCase();
            resultado.push({
              codigo: mov[0],
              fecha: formatearFecha(fechaMov),
              tipo: tipoMov,
              cantidad: parseFloat(mov[3]) || 0,
              producto: prodMap[codigoProducto] || "Producto no encontrado",
              observaciones: mov[6] || "",
              usuario: mov[4] || "N/A"
            });
          }
        }
      } catch (dateError) {
        console.warn(`Fecha inválida en movimiento fila ${i + 1}:`, mov[1]);
        continue;
      }
    }
    
    return resultado.sort((a, b) => {
      const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
      const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
      return fechaB - fechaA;
    });
  } catch (error) {
    console.error("Error en obtenerHistorial:", error);
    return [];
  }
}

function obtenerResumen() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    const movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    
    if (!prodSheet || !movSheet) {
      return { totalProductos: 0, totalMovimientos: 0, sinStock: 0, stockBajo: 0 };
    }
    
    const productos = prodSheet.getDataRange().getValues();
    const movimientos = movSheet.getDataRange().getValues();
    
    const totalProductos = Math.max(0, productos.length - 1);
    const totalMovimientos = Math.max(0, movimientos.length - 1);
    
    let sinStock = 0;
    let stockBajo = 0;
    let valorTotalInventario = 0;
    
    for (let i = 1; i < productos.length; i++) {
      if (!productos[i][0]) continue;
      
      const codigo = productos[i][0];
      const stockMin = Math.max(0, parseInt(productos[i][4]) || 0);
      const stock = calcularStock(codigo);
      
      if (stock <= 0) {
        sinStock++;
      } else if (stock <= stockMin && stockMin > 0) {
        stockBajo++;
      }
      
      valorTotalInventario += stock;
    }
    
    const fechaUnMesAtras = new Date();
    fechaUnMesAtras.setMonth(fechaUnMesAtras.getMonth() - 1);
    
    let movimientosUltimoMes = 0;
    for (let i = 1; i < movimientos.length; i++) {
      if (movimientos[i][1]) {
        try {
          const fechaMov = new Date(movimientos[i][1]);
          if (fechaMov >= fechaUnMesAtras) {
            movimientosUltimoMes++;
          }
        } catch (e) {
          // Ignorar fechas inválidas
        }
      }
    }
    
    return {
      totalProductos,
      totalMovimientos,
      sinStock,
      stockBajo,
      valorTotalInventario: Math.round(valorTotalInventario * 100) / 100,
      movimientosUltimoMes
    };
  } catch (error) {
    console.error("Error en obtenerResumen:", error);
    return { totalProductos: 0, totalMovimientos: 0, sinStock: 0, stockBajo: 0 };
  }
}

function validarIntegridad() {
  const errores = [];
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const hojasRequeridas = [HOJA_PRODUCTOS, HOJA_MOVIMIENTOS, HOJA_UNIDADES, HOJA_GRUPOS];
    hojasRequeridas.forEach(nombreHoja => {
      if (!ss.getSheetByName(nombreHoja)) {
        errores.push(`Falta la hoja requerida: ${nombreHoja}`);
      }
    });
    
    if (errores.length > 0) {
      return { errores };
    }
    
    const prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    const movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    
    const productos = prodSheet.getDataRange().getValues();
    const movimientos = movSheet.getDataRange().getValues();
    
    const codigosVistos = new Set();
    for (let i = 1; i < productos.length; i++) {
      if (!productos[i][0]) continue;
      
      const codigo = productos[i][0].toString().trim().toUpperCase();
      if (codigosVistos.has(codigo)) {
        errores.push(`Código de producto duplicado: ${productos[i][0]}`);
      }
      codigosVistos.add(codigo);
      
      if (!productos[i][1] || productos[i][1].toString().trim().length < 2) {
        errores.push(`Producto ${codigo} tiene nombre inválido`);
      }
      
      const stockMin = productos[i][4];
      if (stockMin && (isNaN(stockMin) || stockMin < 0)) {
        errores.push(`Producto ${codigo} tiene stock mínimo inválido: ${stockMin}`);
      }
    }
    
    const codigosProductos = new Set();
    for (let i = 1; i < productos.length; i++) {
      if (productos[i][0]) {
        codigosProductos.add(productos[i][0].toString().trim().toUpperCase());
      }
    }
    
    for (let i = 1; i < movimientos.length; i++) {
      if (!movimientos[i][0]) continue;
      
      const codigo = movimientos[i][0].toString().trim().toUpperCase();
      const tipo = movimientos[i][2] ? movimientos[i][2].toString().toUpperCase() : "";
      const cantidad = movimientos[i][3];
      
      if (!codigosProductos.has(codigo)) {
        errores.push(`Movimiento para producto inexistente: ${movimientos[i][0]} (fila ${i + 1})`);
      }
      
      if (tipo && !Object.values(TIPOS_MOVIMIENTO).includes(tipo)) {
        errores.push(`Tipo de movimiento inválido: ${tipo} (fila ${i + 1})`);
      }
      
      if (!cantidad || isNaN(cantidad) || cantidad <= 0) {
        errores.push(`Cantidad inválida en movimiento: ${cantidad} (fila ${i + 1})`);
      }
      
      if (movimientos[i][1]) {
        try {
          new Date(movimientos[i][1]);
        } catch (e) {
          errores.push(`Fecha inválida en movimiento (fila ${i + 1}): ${movimientos[i][1]}`);
        }
      }
    }
    
    for (let i = 1; i < productos.length; i++) {
      if (!productos[i][0]) continue;
      
      const codigo = productos[i][0];
      const stock = calcularStock(codigo);
      
      if (stock < 0) {
        errores.push(`Producto ${codigo} tiene stock negativo: ${stock}`);
      }
    }
    
    return { errores };
  } catch (error) {
    errores.push(`Error al validar integridad: ${error.message}`);
    return { errores };
  }
}

function obtenerListas() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    let unidadesSheet = ss.getSheetByName(HOJA_UNIDADES);
    let gruposSheet = ss.getSheetByName(HOJA_GRUPOS);
    
    if (!unidadesSheet) {
      unidadesSheet = ss.insertSheet(HOJA_UNIDADES);
      const unidadesPredeterminadas = [
        ["Unidad"],
        ["Unidades"],
        ["Kilogramos"],
        ["Gramos"],
        ["Toneladas"],
        ["Litros"],
        ["Mililitros"],
        ["Metros"],
        ["Centímetros"],
        ["Metros Cuadrados"],
        ["Metros Cúbicos"],
        ["Piezas"],
        ["Cajas"],
        ["Paquetes"],
        ["Docenas"]
      ];
      unidadesSheet.getRange(1, 1, unidadesPredeterminadas.length, 1).setValues(unidadesPredeterminadas);
      unidadesSheet.getRange(1, 1).setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
    }
    
    if (!gruposSheet) {
      gruposSheet = ss.insertSheet(HOJA_GRUPOS);
      const gruposPredeterminados = [
        ["Grupo"],
        ["Materia Prima"],
        ["Producto Terminado"],
        ["Producto en Proceso"],
        ["Herramientas"],
        ["Consumibles"],
        ["Repuestos"],
        ["Equipos"],
        ["Suministros"],
        ["Empaques"],
        ["Químicos"],
        ["General"]
      ];
      gruposSheet.getRange(1, 1, gruposPredeterminados.length, 1).setValues(gruposPredeterminados);
      gruposSheet.getRange(1, 1).setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
    }
    
    const unidadesData = unidadesSheet.getDataRange().getValues();
    const gruposData = gruposSheet.getDataRange().getValues();
    
    const unidades = unidadesData.slice(1).map(r => r[0]).filter(u => u && u.toString().trim());
    const grupos = gruposData.slice(1).map(r => r[0]).filter(g => g && g.toString().trim());
    
    return { 
      unidades: unidades.sort(), 
      grupos: grupos.sort() 
    };
  } catch (error) {
    console.error("Error en obtenerListas:", error);
    return { 
      unidades: ["Unidades", "Kilogramos", "Litros", "Piezas"], 
      grupos: ["General", "Materia Prima", "Producto Terminado"] 
    };
  }
}

function exportarStockCSV() {
  try {
    const stock = obtenerStock();
    
    if (stock.length === 0) {
      return null;
    }
    
    let csv = "\uFEFF";
    csv += "Código,Nombre,Unidad,Grupo,Stock Mínimo,Stock Actual,Estado,Diferencia\n";
    
    stock.forEach(producto => {
      let estado = "Normal";
      let diferencia = "";
      
      if (producto.cantidad <= 0) {
        estado = "Sin Stock";
        diferencia = `-${producto.stockMin}`;
      } else if (producto.cantidad <= producto.stockMin && producto.stockMin > 0) {
        estado = "Stock Bajo";
        diferencia = `-${producto.stockMin - producto.cantidad}`;
      } else {
        diferencia = `+${producto.cantidad - producto.stockMin}`;
      }
      
      csv += `"${producto.codigo}","${producto.nombre}","${producto.unidad}","${producto.grupo}",${producto.stockMin},${producto.cantidad},"${estado}","${diferencia}"\n`;
    });
    
    const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    const nombreArchivo = `Inventario_${fechaHora}.csv`;
    
    const blob = Utilities.newBlob(csv, 'text/csv; charset=utf-8', nombreArchivo);
    
    let carpeta;
    try {
      carpeta = DriveApp.getFoldersByName(CONFIG.carpetaReportes).next();
    } catch (e) {
      carpeta = DriveApp.getRootFolder();
    }
    
    const archivo = carpeta.createFile(blob);
    
    return archivo.getUrl();
  } catch (error) {
    console.error("Error en exportarStockCSV:", error);
    return null;
  }
}

function inicializarHojas() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Inicializar hoja PRODUCTOS
    let prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!prodSheet) {
      prodSheet = ss.insertSheet(HOJA_PRODUCTOS);
    }
    
    if (prodSheet.getLastRow() === 0) {
      const encabezados = [["Código", "Nombre", "Unidad", "Grupo", "Stock Mínimo", "Fecha Creación"]];
      prodSheet.getRange(1, 1, 1, 6).setValues(encabezados);
      const headerRange = prodSheet.getRange(1, 1, 1, 6);
      headerRange.setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
      
      prodSheet.getRange("A:A").setNumberFormat("@");
      prodSheet.getRange("E:E").setNumberFormat("0");
      prodSheet.getRange("F:F").setNumberFormat("dd/mm/yyyy hh:mm");
      
      prodSheet.autoResizeColumns(1, 6);
    }
    
    // Inicializar hoja MOVIMIENTOS
    let movSheet = ss.getSheetByName(HOJA_MOVIMIENTOS);
    if (!movSheet) {
      movSheet = ss.insertSheet(HOJA_MOVIMIENTOS);
    }
    
    if (movSheet.getLastRow() === 0) {
      const encabezados = [["Código", "Fecha", "Tipo", "Cantidad", "Usuario", "Timestamp", "Observaciones", "Stock Resultante"]];
      movSheet.getRange(1, 1, 1, 8).setValues(encabezados);
      const headerRange = movSheet.getRange(1, 1, 1, 8);
      headerRange.setBackground(CONFIG.colores.acento).setFontColor("white").setFontWeight("bold");
      
      movSheet.getRange("A:A").setNumberFormat("@");
      movSheet.getRange("B:B").setNumberFormat("dd/mm/yyyy");
      movSheet.getRange("D:D").setNumberFormat("0.##");
      movSheet.getRange("F:F").setNumberFormat("dd/mm/yyyy hh:mm:ss");
      movSheet.getRange("H:H").setNumberFormat("0.##");
      
      movSheet.autoResizeColumns(1, 8);
    }
    
    // Inicializar listas de unidades y grupos
    obtenerListas();
    
    return "Sistema inicializado correctamente. Todas las hojas han sido creadas y configuradas.";
  } catch (error) {
    console.error("Error en inicializarHojas:", error);
    return `Error al inicializar sistema: ${error.message}`;
  }
}

function getTipoMovimientoTexto(tipo) {
  switch (tipo.toUpperCase()) {
    case TIPOS_MOVIMIENTO.INGRESO:
      return "Ingreso";
    case TIPOS_MOVIMIENTO.SALIDA:
      return "Salida";
    case TIPOS_MOVIMIENTO.AJUSTE_POSITIVO:
      return "Ajuste Positivo";
    case TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO:
      return "Ajuste Negativo";
    case TIPOS_MOVIMIENTO.AJUSTE:
      return "Ajuste";
    default:
      return tipo;
  }
}

function formatearFecha(fecha) {
  try {
    const f = new Date(fecha);
    if (isNaN(f.getTime())) {
      throw new Error("Fecha inválida");
    }
    return Utilities.formatDate(f, Session.getScriptTimeZone(), "dd/MM/yyyy");
  } catch (error) {
    console.error("Error en formatearFecha:", error);
    return "Fecha inválida";
  }
}