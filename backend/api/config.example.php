<?php
return [
    'nombreSistema' => 'Clinica Veterinaria',
    'nombreCorto'   => 'CLINICA',
    'zona'          => 'America/Mexico_City',

    // Datos que se muestran en el login y en el pie de página del sistema.
    'clinica' => [
        'doctor'      => '#DOCTOR',
        'cedula'      => '#CEDULA',
        'direccion'   => '#DIRECCION',
        'telefono'    => '#TELEFONO',
    ],

    // Datos de MySQL (en XAMPP/WAMP: usuario root y contraseña vacía; en hosting: los que te dé el panel)
    'db' => [
        'host' => 'localhost:3308',
        'name' => 'clinica_veterinaria',
        'user' => '#EXAMPLE',
        'pass' => '#EXAMPLE',
    ],

    // Único usuario del sistema. El hash se genera con:
    //   php -r "echo password_hash('TU_CLAVE', PASSWORD_DEFAULT);"
    // Pega el resultado completo (empieza con $2y$...) entre comillas SIMPLES.
    'admin' => [
        'usuario' => '#USER',
        'hash'    => '#HASH',
    ],

    'colores' => [
        'principal'      => '#8db5b1',//header
        'secundario'     => '#079484',//slidebar
        'acento'         => '#bdccc8',
        'fondo'          => '#EAF6FB',
        'fondoContenido' => '#FAFBFC',
        'borde'          => '#E5F2F7',
        'tarjeta'        => '#F0F8FC',
    ],
];