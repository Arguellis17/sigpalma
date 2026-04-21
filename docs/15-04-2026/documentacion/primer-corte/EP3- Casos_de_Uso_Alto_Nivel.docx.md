# **Documento de Casos de Uso \- Alto Nivel**

Propósito: Este documento describe de forma comprensible y sin tecnicismos excesivos las interacciones clave entre actores y el sistema para alinear el entendimiento del equipo, alimentar el backlog (épicas/historias) y apoyar el diseño posterior.

# **CU1:** Registro de Usuarios

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU01 |
| **Nombre del caso de uso:** | Registro de Usuarios |
| **Módulo/Épica asociada:** | Seguridad e Identidad |
| **Actor(es) principal(es):** | Administrador del Sistema / Gerente |
| **Stakeholders interesados:** | Administrador, Técnicos Agrónomos, Operadores de Campo |
| **Prioridad:** | Alta |
| **Estado:** | Definido  |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Permitir la creación de cuentas de usuario dentro de la plataforma para delegar responsabilidades técnicas y operativas bajo un esquema de seguridad robusto.  
* **Alcance / Límites:** Abarca desde la captura de datos básicos del personal hasta la persistencia cifrada en la base de datos y la generación de logs de auditoría. No incluye la recuperación de contraseñas (cubierto en CU02).

## **3\. Suposiciones y restricciones**

* **Suposiciones:** El Administrador ya cuenta con acceso previo al sistema y conoce el rol que desempeñará el nuevo usuario.  
* **Restricciones:** El sistema no integrará automatización de hardware para el registro en esta fase; las credenciales se gestionan manualmente por el administrador.

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El administrador debe haber iniciado sesión en la plataforma y contar con los permisos de gestión de usuarios.  
* **Postcondiciones de éxito:** Se crea una nueva entidad de usuario vinculada a un rol institucional y se genera automáticamente una entrada en la bitácora de auditoría.  
* **Postcondiciones de fallo:** El sistema bloquea la transacción, muestra un mensaje de error y no persiste ningún dato en la base de datos.

## **5\. Flujo principal (alto nivel)**

1. El Administrador accede al panel de administración de usuarios.  
2. El sistema presenta el listado de usuarios activos.  
3. El Administrador acciona el comando de creación de nuevo usuario.  
4. El sistema habilita la interfaz de entrada de datos.  
5. El Administrador diligencia el nombre, correo electrónico y selecciona el rol (Técnico u Operador).  
6. El sistema verifica la integridad de los datos y la disponibilidad del correo electrónico.  
7. El Administrador envía el formulario para procesamiento.  
8. El sistema procesa el hash de la contraseña (Bcrypt), guarda en PostgreSQL y genera el log de auditoría.  
9. El sistema confirma el registro exitoso al Administrador.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Datos inválidos):** Si el Administrador proporciona un formato de correo inválido o un documento ya existente, el sistema resalta los errores y bloquea el envío hasta su corrección.  
* **EX-1 (Validación de duplicidad):** Si el correo ya está en uso, el sistema emite una advertencia de que el correo no puede repetirse (RN01).

## **7\. Reglas de negocio**

* **RN01:** El correo electrónico debe ser único en el sistema.  
* **RN02:** El rol asignado debe pertenecer estrictamente al catálogo (Técnico Agrónomo u Operador de Campo).  
* **RN03:** Las contraseñas deben ser cifradas mediante algoritmos de hash (Bcrypt).  
* **RN04:** Todo registro nuevo debe generar una entrada en la bitácora de auditoría para asegurar la trazabilidad.

## **8\. Datos y validaciones clave**

* **Entradas principales:** Nombre completo, Correo electrónico, Documento de Identidad y Selección de Rol.  
* **Validaciones:** Verificación de formato Regex para el correo, consulta de unicidad en tiempo real en el servidor (FastAPI) y campos obligatorios.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** el administrador está en el formulario de registro, **When** ingresa datos válidos y selecciona un rol, **Then** el sistema almacena el registro y confirma el éxito.  
* **CA-2:** **Given** el administrador intenta registrar un correo ya existente, **When** procesa el formulario, **Then** el sistema bloquea la transacción y notifica la duplicidad.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Interfaz web diseñada en Next.js con formulario centrado y validaciones visuales.  
* **Mensajes/Etiquetas clave:** Notificaciones tipo "Toast" para retroalimentación inmediata tras el guardado exitoso o fallido.

## **11\. Consideraciones no funcionales**

* **Seguridad:** Implementación de lógica de hashing Bcrypt en el backend.  
* **Auditabilidad:** Registro obligatorio de la acción en la tabla de auditoría (RNF-12).

# **CU2:** Gestión de Usuarios

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU02 |
| **Nombre del caso de uso:** | Gestión de Usuarios |
| **Módulo/Épica asociada:** | Seguridad e Identidad |
| **Actor(es) principal(es):** | Administrador del Sistema |
| **Stakeholders interesados:** | Gerencia, Auditores de Trazabilidad, Personal Administrativo |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Administrar el ciclo de vida de las cuentas de usuario, permitiendo la actualización de perfiles, el restablecimiento de credenciales y la revocación de accesos sin comprometer la integridad histórica de los datos.  
* **Alcance / Límites:** Incluye la edición de metadatos del usuario, el cambio de estado (Activo/Inactivo) y la generación de contraseñas temporales. No contempla la creación inicial (CU01) ni la gestión de permisos granulares por módulo.

## **3\. Suposiciones y restricciones**

* **Suposiciones:** Existen registros de usuarios previos en el sistema. El administrador tiene acceso a una conexión estable para persistir cambios en tiempo real.  
* **Restricciones:** Queda estrictamente prohibido el borrado físico (DELETE) de cualquier usuario para garantizar la trazabilidad RSPO (RN05).

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El administrador debe estar autenticado y posicionado en el panel de control de usuarios.  
* **Postcondiciones de éxito:** Los cambios se reflejan inmediatamente en la base de datos PostgreSQL, se actualiza el estado de acceso del usuario y se registra el evento en la bitácora de auditoría.  
* **Postcondiciones de fallo:** El sistema revierte cualquier cambio parcial y notifica al administrador sobre la inconsistencia o fallo de red.

## **5\. Flujo principal (alto nivel)**

1. El Administrador visualiza la lista global de usuarios en la tabla de datos (DataGrid).  
2. El sistema carga los registros activos e inactivos desde PostgreSQL.  
3. El Administrador localiza un usuario y selecciona la acción "Editar".  
4. El sistema despliega el formulario con la información precargada del usuario.  
5. El Administrador modifica los campos permitidos (Nombre, Rol) o acciona el interruptor de estado a "Inactivo".  
6. El sistema valida que los cambios no violen reglas de unicidad o seguridad.  
7. El Administrador confirma la actualización de la ficha.  
8. El sistema ejecuta el comando UPDATE, genera el sello de auditoría y confirma el éxito.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Restablecimiento de Contraseña):** El Administrador selecciona la opción "Restablecer Contraseña". El sistema genera una clave temporal aleatoria, la cifra con Bcrypt y la muestra en pantalla para ser comunicada al usuario (RN07).  
* **EX-1 (Protección de SuperAdmin):** El sistema bloquea cualquier intento de inactivar la cuenta del Administrador Principal para evitar bloqueos totales del sistema.

## **7\. Reglas de negocio**

* **RN05:** Prohibido el borrado físico de usuarios para mantener la integridad referencial de labores y cosechas pasadas.  
* **RN06:** La inactivación de un usuario debe impedir su inicio de sesión de forma inmediata.  
* **RN07:** El restablecimiento de contraseña debe generar una cadena temporal que obligue al cambio en el próximo ingreso.

## **8\. Datos y validaciones clave**

* **Entradas principales:** Selección de usuario, nuevo Rol, Estado (Boolean), Confirmación de Reset.  
* **Validaciones:** Filtros de búsqueda por nombre/correo/documento. Verificación de que el usuario a editar no sea el mismo administrador en sesión si se intenta inactivar.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** el administrador selecciona un usuario activo, **When** cambia su estado a "Inactivo", **Then** el sistema bloquea el acceso del usuario pero mantiene su nombre en los registros históricos de cosecha.  
* **CA-2:** **Given** se requiere una nueva clave, **When** el administrador usa la función de reset, **Then** el sistema genera una clave temporal y registra la acción en la auditoría.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Interfaz de tabla (DataGrid) con filtros avanzados y botones de acción rápida en cada fila.  
* **Mensajes/Etiquetas clave:** Notificación "Usuario actualizado con éxito" y alertas de advertencia "Confirmar inactivación: esta acción impedirá el acceso al sistema".

## **11\. Consideraciones no funcionales**

* **Borrado Lógico:** Implementación técnica mediante columna is\_active en la tabla de usuarios.  
* **Trazabilidad:** Persistencia del ID del administrador y fecha exacta de la modificación para auditorías RSPO.

# **CU3:** Registro y Modificación de Fincas

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU03 |
| **Nombre del caso de uso:** | Registro y Modificación de Fincas |
| **Módulo/Épica asociada:** | Gestión de Infraestructura Agrícola |
| **Actor(es) principal(es):** | Administrador del Sistema / Técnico Agrónomo |
| **Stakeholders interesados:** | Dueños de Fincas, Auditores RSPO, Gerencia Operativa |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Registrar y gestionar la información básica y legal de las fincas palmicultoras para establecer la base de la trazabilidad geográfica del aceite.  
* **Alcance / Límites:** Comprende la creación de la ficha técnica de la finca (nombre, ubicación, área total, contacto). No incluye la subdivisión en lotes (CU04) ni el mapeo por coordenadas GPS en esta fase (según restricciones de no IoT/sensores).

## **3\. Suposiciones y restricciones**

* **Suposiciones:** El usuario tiene los documentos legales de la propiedad para ingresar datos precisos de hectáreas.  
* **Restricciones:** El sistema debe validar que el área total de la finca sea mayor a cero y coherente con las unidades de medida estándar (Hectáreas). No se integran mapas satelitales en tiempo real en esta fase inicial.

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El usuario debe tener rol de Administrador o Técnico y haber iniciado sesión.  
* **Postcondiciones de éxito:** La finca queda registrada en la base de datos, lista para que se le asignen lotes de cultivo. Se genera un ID único de finca.  
* **Postcondiciones de fallo:** Si los datos obligatorios faltan o el área es inconsistente, el sistema impide el guardado y señala el error.

## **5\. Flujo principal (alto nivel)**

1. El usuario ingresa al módulo de "Configuración Agrícola" y selecciona "Fincas".  
2. El sistema muestra el listado de fincas existentes.  
3. El usuario selecciona "Registrar Nueva Finca".  
4. El sistema despliega un formulario solicitando: Nombre, Ubicación (Municipio/Departamento), Área Total (Ha), y Propietario.  
5. El usuario completa la información técnica y legal requerida.  
6. El sistema valida que el nombre de la finca no esté duplicado para ese propietario.  
7. El usuario confirma el registro.  
8. El sistema guarda la información en la tabla fincas de PostgreSQL.  
9. El sistema emite un mensaje de confirmación y permite visualizar la ficha creada.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Modificación de datos):** El usuario selecciona una finca existente, edita el área total o el contacto, y guarda los cambios. El sistema actualiza el registro sin cambiar el ID original.  
* **EX-1 (Área Excedida):** Si el usuario intenta registrar un área que matemáticamente no coincide con la suma de sus lotes (en caso de edición posterior), el sistema emitirá una advertencia de inconsistencia.

## **7\. Reglas de negocio**

* **RN08:** Cada finca debe tener un nombre único dentro de la organización para evitar confusiones en los reportes de cosecha.  
* **RN09:** El área total de la finca se expresa obligatoriamente en Hectáreas (Ha).  
* **RN10:** No se permite la eliminación de fincas que tengan registros de cosecha o labores asociados (integridad RSPO).

## **8\. Datos y validaciones clave**

* **Entradas principales:** Nombre de la finca, Departamento/Municipio, Área total, Cédula/NIT del propietario.  
* **Validaciones:** El campo "Área Total" debe ser numérico y positivo. El nombre de la finca no puede quedar vacío.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** el técnico ingresa los datos de una nueva finca de 50 Ha, **When** guarda la información, **Then** el sistema le asigna un código de trazabilidad único y la muestra en el listado global.  
* **CA-2:** **Given** el usuario intenta dejar el campo "Nombre" vacío, **When** intenta guardar, **Then** el sistema resalta el campo en rojo y bloquea la transacción.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Formulario de registro con pestañas para "Información Básica" e "Información de Contacto".  
* **Mensajes/Etiquetas clave:** "Finca registrada correctamente. Ya puede proceder a crear los lotes de cultivo."

## **11\. Consideraciones no funcionales**

* **Disponibilidad:** El módulo de fincas debe estar disponible 24/7 para consultas de auditoría.  
* **Escalabilidad:** El diseño de la tabla debe permitir que una finca crezca en número de lotes sin afectar el rendimiento.

---

# **CU4:** Registro y Modificación de Lotes

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU04 |
| **Nombre del caso de uso:** | Registro y Modificación de Lotes |
| **Módulo/Épica asociada:** | Gestión de Infraestructura Agrícola |
| **Actor(es) principal(es):** | Técnico Agrónomo |
| **Stakeholders interesados:** | Gerencia Operativa, Supervisores de Campo, Auditores RSPO |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Permitir la subdivisión técnica de una finca en unidades de manejo (lotes), registrando variables críticas como el material genético y el año de siembra para el cálculo de productividad.  
* **Alcance / Límites:** Incluye la creación, edición de parámetros agronómicos y visualización de la ficha del lote. No incluye el registro de actividades diarias (esto se hace en CU05/CU06/CU07).

## **3\. Suposiciones y restricciones**

* **Suposiciones:** La finca ya ha sido creada previamente en el sistema (CU03). El técnico conoce los datos del material vegetal (certificados).  
* **Restricciones:** Un lote no puede existir sin estar vinculado a una finca. El año de siembra debe ser un año válido (no futuro).

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El técnico debe estar autenticado y tener seleccionada la finca correspondiente.  
* **Postcondiciones de éxito:** El lote queda registrado y vinculado a la "Ruta Técnica" de la finca. El sistema queda listo para recibir reportes de plagas o cosecha para esa unidad.  
* **Postcondiciones de fallo:** El sistema rechaza el registro si la suma de las hectáreas de los lotes excede el área total reportada de la finca.

## **5\. Flujo principal (alto nivel)**

1. El técnico ingresa al detalle de una Finca específica.  
2. El sistema muestra la lista de lotes actuales de esa finca.  
3. El técnico selecciona "Agregar Nuevo Lote".  
4. El sistema despliega el formulario con los campos: Código/Nombre del lote, Área (Ha), Año de Siembra, Material Genético (Ej: Tenera, Guinea), y Densidad (Palmas por Ha).  
5. El técnico diligencia la información técnica.  
6. El sistema valida la consistencia del área con respecto al total de la finca (RN11).  
7. El técnico confirma el guardado.  
8. El sistema persiste los datos en PostgreSQL y genera el registro de auditoría.  
9. El sistema actualiza el inventario de hectáreas productivas de la finca.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Edición de Material Genético):** Si se cometió un error en el tipo de palma, el técnico puede editar la ficha del lote. El sistema guarda la versión anterior en el log para trazabilidad.  
* **EX-1 (Área Excedida):** Si el lote nuevo hace que la suma de áreas supere la declarada en la finca, el sistema muestra un error: "Error: El área total de los lotes no puede ser mayor a las \[X\] hectáreas de la finca."

## **7\. Reglas de negocio**

* **RN11:** La sumatoria del área de todos los lotes debe ser menor o igual al área total de la finca registrada en el CU03.  
* **RN12:** Cada lote debe tener un identificador único (Código de Lote) dentro de su respectiva finca.  
* **RN13:** El año de siembra es obligatorio, ya que determina el ciclo de madurez para los indicadores de cosecha.

## **8\. Datos y validaciones clave**

* **Entradas principales:** ID de Finca (FK), Nombre/Código del Lote, Área (Ha), Año de Siembra, Material Genético, Número de palmas.  
* **Validaciones:** Área \> 0; Año de Siembra \<= Año Actual; Material Genético seleccionado de una lista predefinida (certificados).

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** que una finca tiene 100 Ha y ya existen lotes que suman 90 Ha, **When** el técnico intenta crear un lote de 15 Ha, **Then** el sistema arroja un mensaje de error por exceso de área.  
* **CA-2:** **Given** un lote recién creado, **When** el técnico consulta el panel de indicadores, **Then** el lote debe aparecer disponible para asignar labores o reportar cosechas.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Dashboard de Finca con tarjetas (cards) que representan cada lote y muestran su estado (Año de siembra/Variedad).  
* **Mensajes/Etiquetas clave:** "Lote \[ID\] registrado exitosamente. Ha iniciado la Ruta Técnica para este sector."

## **11\. Consideraciones no funcionales**

* **Integridad Referencial:** Uso de llaves foráneas en la base de datos para asegurar que no existan "lotes huérfanos".  
* **Rendimiento:** La consulta de lotes por finca debe responder en menos de 1 segundo para agilizar la operación en campo.

# **CU5:** Gestión de Insumos y Fertilizantes

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU05 |
| **Nombre del caso de uso:** | Gestión de Insumos y Fertilizantes |
| **Módulo/Épica asociada:** | Gestión de Inventarios y Nutrición |
| **Actor(es) principal(es):** | Técnico Agrónomo / Almacenista |
| **Stakeholders interesados:** | Gerencia, Auditores RSPO, Proveedores |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Registrar la entrada, salida y stock actual de insumos (fertilizantes, herbicidas, plaguicidas) para garantizar que solo se apliquen productos autorizados y en cantidades controladas.  
* **Alcance / Límites:** Cubre el registro de compras (entradas) y el egreso de bodega para aplicación en campo. No incluye la aplicación técnica en el lote (esto se vincula en la Ruta Técnica), sino el control del inventario físico.

## **3\. Suposiciones y restricciones**

* **Suposiciones:** Se dispone de las fichas técnicas y registros ICA de los insumos. El sistema cuenta con unidades de medida configuradas (Kg, L, Bultos).  
* **Restricciones:** No se permite el egreso de insumos que no tengan stock disponible. El sistema debe alertar sobre productos con etiquetas de toxicidad prohibidas por RSPO.

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El usuario debe tener permisos de gestión de bodega. Los proveedores deben estar creados (o registrarse en el flujo).  
* **Postcondiciones de éxito:** El stock se actualiza en tiempo real. Se genera un movimiento de inventario con sello de tiempo y responsable.  
* **Postcondiciones de fallo:** Si hay discrepancias en cantidades o falta información obligatoria (lote de fabricación, fecha de vencimiento), la transacción se cancela.

## **5\. Flujo principal (alto nivel)**

1. El usuario accede al módulo de "Inventarios" y selecciona "Movimientos".  
2. El sistema muestra el estado actual de la bodega.  
3. El usuario selecciona el tipo de operación: **Entrada** (Compra/Donación) o **Salida** (Aplicación/Baja).  
4. El sistema despliega el formulario: Nombre del insumo, Cantidad, Unidad, Fecha de Vencimiento y Número de Lote/Factura.  
5. El usuario ingresa los datos del producto.  
6. El sistema valida que el producto esté catalogado y su fecha de vencimiento sea futura.  
7. El usuario confirma el movimiento.  
8. El sistema actualiza el saldo en la tabla inventarios y registra el historial en la bitácora.  
9. El sistema emite una alerta si el stock cae por debajo del punto de reorden definido.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Registro de nuevo insumo):** Si el insumo no existe en el catálogo, el sistema permite crearlo adjuntando su categoría (Fertilizante, Plaguicida, etc.).  
* **EX-1 (Stock Insuficiente):** Si se intenta registrar una salida mayor a la existencia física, el sistema bloquea la acción y muestra: "Error: Stock insuficiente para realizar el egreso".

## **7\. Reglas de negocio**

* **RN14:** Todo insumo químico debe registrar obligatoriamente su fecha de vencimiento y registro de autoridad competente (ICA).  
* **RN15:** El sistema debe impedir el registro de insumos prohibidos por la normativa de sostenibilidad vigente (Lista roja RSPO).  
* **RN16:** Solo el rol de Administrador o Almacenista puede ajustar inventarios manualmente por motivos de pérdida o daño.

## **8\. Datos y validaciones clave**

* **Entradas principales:** Nombre Comercial, Ingrediente Activo, Cantidad, Unidad de medida, Fecha de Vencimiento.  
* **Validaciones:** Cantidad \> 0; Validación de tipo de dato (numérico para saldos); Alerta automática si la fecha de vencimiento es menor a 3 meses.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** que un técnico retira 10 bultos de Nitrógeno, **When** el sistema procesa la salida, **Then** el saldo total de Nitrógeno en bodega debe disminuir exactamente en 10 unidades.  
* **CA-2:** **Given** el ingreso de un nuevo lote de herbicida, **When** el usuario olvida poner la fecha de vencimiento, **Then** el sistema impide el guardado y resalta el campo obligatorio.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Panel de control con indicadores de "Insumos por vencer" y "Stock Crítico".  
* **Mensajes/Etiquetas clave:** "Movimiento de inventario exitoso. Saldo actual: \[X\] unidades."

## **11\. Consideraciones no funcionales**

* **Consistencia:** Las transacciones de inventario deben ser atómicas (ACID) para evitar duplicidad de saldos en accesos concurrentes.  
* **Trazabilidad:** Cada movimiento debe estar ligado al ID del usuario que lo realizó para auditorías de uso de agroquímicos.

# **CU6:** Registro de Monitoreo de Plagas y Enfermedades

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU06 |
| **Nombre del caso de uso:** | Registro de Monitoreo de Plagas y Enfermedades |
| **Módulo/Épica asociada:** | Sanidad Vegetal (MIP) |
| **Actor(es) principal(es):** | Técnico Agrónomo / Monitor de Sanidad |
| **Stakeholders interesados:** | Gerencia Técnica, Auditores RSPO, ICA |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Registrar los hallazgos de plagas o enfermedades detectados durante el censo fitosanitario en lotes específicos para determinar umbrales de acción.  
* **Alcance / Límites:** Incluye el registro de la plaga detectada, el nivel de incidencia (número de individuos o palmas afectadas) y la recomendación técnica. No incluye la aplicación del tratamiento (esto se registra como una labor técnica posterior).

## **3\. Suposiciones y restricciones**

* **Suposiciones:** El técnico ya tiene identificado el lote (CU04) y conoce la sintomatología de las plagas comunes de la palma.  
* **Restricciones:** El registro es manual; el sistema no detecta plagas automáticamente mediante imágenes en esta fase. El catálogo de plagas debe estar previamente cargado.

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El lote debe estar registrado y activo. El usuario debe tener rol de Técnico.  
* **Postcondiciones de éxito:** Se genera un "Ticket de Alerta Fitosanitaria" vinculado al historial del lote (Ruta Técnica). El sistema queda listo para generar reportes de incidencia.  
* **Postcondiciones de fallo:** El registro no se guarda si no se especifica el tipo de plaga o el nivel de afectación, manteniendo el historial limpio de datos incompletos.

## **5\. Flujo principal (alto nivel)**

1. El técnico selecciona el módulo de "Sanidad Vegetal" y la opción "Nuevo Monitoreo".  
2. El sistema solicita seleccionar la Finca y el Lote inspeccionado.  
3. El técnico elige el tipo de plaga/enfermedad de una lista desplegable (Ej: *Rhynchophorus palmarum*, *Pudrición del Cogollo*).  
4. El técnico ingresa los datos del censo: número de palmas evaluadas vs. número de palmas afectadas.  
5. El sistema calcula automáticamente el porcentaje de incidencia (%).  
6. El técnico adjunta una observación o recomendación (Ej: "Requiere cirugía de cogollo" o "Instalar trampas").  
7. El técnico confirma el registro.  
8. El sistema guarda la información con fecha, hora y georreferenciación básica del lote.  
9. El sistema emite una alerta visual si el porcentaje de incidencia supera el umbral crítico definido.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Sin hallazgos):** Si el técnico realiza el monitoreo y no encuentra plagas, registra "Incidencia 0". Esto es vital para demostrar ante RSPO que se están realizando censos preventivos.  
* **EX-1 (Plaga no catalogada):** Si la plaga no aparece en la lista, el sistema permite marcar "Otra" y escribir el nombre, generando un aviso al Administrador para actualizar el catálogo.

## **7\. Reglas de negocio**

* **RN17:** Todo registro de sanidad debe estar anclado a un lote y a un responsable técnico.  
* **RN18:** El sistema debe calcular la incidencia basándose en la densidad de palmas del lote registrada en el CU04.  
* **RN19:** Los registros de sanidad vegetal no pueden ser editados después de 24 horas de su creación para evitar alteraciones en auditorías de sostenibilidad.

## **8\. Datos y validaciones clave**

* **Entradas principales:** ID de Lote, Tipo de Plaga, Palmas Afectadas, Observaciones.  
* **Validaciones:** El número de palmas afectadas no puede ser mayor al número total de palmas del lote. La fecha del monitoreo no puede ser futura.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** un lote de 143 palmas, **When** el técnico registra 15 palmas con *Marchitez*, **Then** el sistema debe mostrar una incidencia del 10.4% y marcar el registro en color naranja/rojo.  
* **CA-2:** **Given** un reporte guardado exitosamente, **When** se consulta la "Ruta Técnica" del lote, **Then** el hallazgo debe aparecer cronológicamente en el historial.

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Formulario móvil optimizado para ingreso rápido en campo. Mapa de calor (Heatmap) básico por lotes basado en la incidencia reportada.  
* **Mensajes/Etiquetas clave:** "Alerta: El umbral de daño económico ha sido superado en el Lote \[X\]. Se recomienda intervención inmediata."

## **11\. Consideraciones no funcionales**

* **Disponibilidad Offline:** (Deseable, pero condicionado a la fase inicial) El sistema debe priorizar la carga rápida de datos incluso con baja señal de red.  
* **Seguridad:** Los datos fitosanitarios son sensibles para la competitividad de la finca; el acceso debe estar restringido a personal técnico.

# **CU7:** Registro de Cosecha (RFF)

| Campo | Contenido |
| :---- | :---- |
| **CU-Id:** | CU07 |
| **Nombre del caso de uso:** | Registro de Cosecha (RFF) |
| **Módulo/Épica asociada:** | Producción y Cosecha |
| **Actor(es) principal(es):** | Operador de Campo / Técnico Agrónomo |
| **Stakeholders interesados:** | Gerencia, Planta de Beneficio (Extractora), Auditores RSPO |
| **Prioridad:** | Alta |
| **Estado:** | Definido |

## **2\. Objetivo y alcance**

* **Objetivo del CU:** Registrar la cantidad y calidad de la fruta cosechada por lote, asegurando que se cumplan los criterios de madurez para maximizar la extracción de aceite.  
* **Alcance / Límites:** Inicia con la selección del lote en cosecha y termina con el registro del peso (estimado o real) y número de racimos. No incluye la logística de transporte externo ni la liquidación de pagos a trabajadores.

## **3\. Suposiciones y restricciones**

* **Suposiciones:** El lote ya tiene una "Ruta Técnica" activa. El operario identifica visualmente los criterios de madurez (frutos sueltos).  
* **Restricciones:** En esta fase inicial, el peso se ingresa manualmente (no hay básculas IoT conectadas). El sistema debe permitir el registro incluso en zonas de baja conectividad para su posterior sincronización.

## **4\. Precondiciones y Postcondiciones**

* **Precondiciones:** El lote debe estar registrado y en edad productiva (determinado por el año de siembra en CU04). El usuario debe estar autenticado.  
* **Postcondiciones de éxito:** Se genera un registro de cosecha con ID único de trazabilidad. Se actualiza el indicador de productividad del lote ($toneladas/hectárea$).  
* **Postcondiciones de fallo:** Si no se especifica el lote o la cantidad es inconsistente (ej. valores negativos), el sistema rechaza el registro.

## **5\. Flujo principal (alto nivel)**

1. El operador accede al módulo "Cosecha" y selecciona "Registrar Remisión".  
2. El sistema solicita la selección del Lote y la fecha de la jornada.  
3. El operador ingresa el número total de racimos cosechados.  
4. El operador ingresa el peso total en kilogramos o toneladas (según configuración).  
5. El sistema solicita marcar el cumplimiento del criterio de madurez (¿Había de 2 a 5 frutos caídos por racimo?).  
6. El operador confirma que el fruto es apto para envío a extractora.  
7. El sistema valida que el peso sea coherente con el histórico del lote para evitar errores de dedo.  
8. El sistema guarda el registro y genera un código de remisión digital para la trazabilidad hacia la planta.  
9. El sistema actualiza el tablero de control de producción diaria.

## **6\. Flujos alternativos y excepciones**

* **FA-1 (Registro de Fruto Sobre-maduro o Verde):** Si el operador detecta que una fracción del lote fue cortada fuera de norma, lo registra en el campo de "Observaciones de Calidad" para que el técnico tome medidas correctivas en el próximo ciclo.  
* **EX-1 (Lote No Productivo):** Si se intenta registrar cosecha en un lote cuyo año de siembra indica que aún está en etapa de levante (vivero/juvenil), el sistema emite una advertencia de bloqueo.

## **7\. Reglas de negocio**

* **RN20:** El criterio de cosecha óptima es de 2 a 5 frutos desprendidos naturalmente en el suelo por cada racimo.  
* **RN21:** Todo registro de cosecha debe generar un ID de trazabilidad que vincule: Finca \+ Lote \+ Fecha \+ Responsable.  
* **RN22:** No se permite el registro de cosechas con fecha anterior a la última labor de aplicación de agroquímicos si esta se encuentra dentro del "periodo de carencia" (según CU05).

## **8\. Datos y validaciones clave**

* **Entradas principales:** ID de Lote, Cantidad de Racimos, Peso (Kg/Ton), Criterio de Madurez (Checklist).  
* **Validaciones:** Peso \> 0\. El sistema debe calcular el peso promedio por racimo ($PesoTotal / NumRacimos$) y alertar si es atípico para el material genético del lote.

## **9\. Criterios de aceptación (alto nivel)**

* **CA-1:** **Given** un lote de palma Guinea de 5 años, **When** el operador registra 2,500 kg de fruta, **Then** el sistema guarda el dato y actualiza el acumulado mensual de la finca.  
* **CA-2:** **Given** un registro de cosecha, **When** el auditor RSPO consulta el código de remisión, **Then** el sistema debe mostrar toda la ruta técnica previa de ese lote (fertilizantes y plagas).

## **10\. Referencias de interfaz**

* **Boceto / Wireframe relacionado:** Pantalla de "Carga Rápida" con teclado numérico grande para facilitar el uso en campo.  
* **Mensajes/Etiquetas clave:** "Remisión Generada. Este lote de fruta cumple con los estándares RSPO."

## **11\. Consideraciones no funcionales**

* **Integridad:** El registro de cosecha es inalterable una vez enviado a la extractora (cierre de lote).  
* **Escalabilidad:** El sistema debe soportar múltiples registros simultáneos durante los picos de cosecha (mitaca).

