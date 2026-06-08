import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

const expectIncludes = (source, snippet, description) => {
  if (!source.includes(snippet)) failures.push(description);
};

const expectRegex = (source, regex, description) => {
  if (!regex.test(source)) failures.push(description);
};

const inviteDialog = read('src/components/admin/users/InviteUserDialog.tsx');
const editProductsDialog = read('src/components/admin/users/EditUserProductsDialog.tsx');
const legacyAdminUsers = read('src/pages/AdminUsers.tsx');
const dashboardLayout = read('src/components/dashboard/DashboardLayout.tsx');
const viesPage = read('src/pages/Vies.tsx');

for (const [name, source] of [
  ['InviteUserDialog', inviteDialog],
  ['EditUserProductsDialog', editProductsDialog],
  ['AdminUsers legacy', legacyAdminUsers],
]) {
  expectIncludes(
    source,
    'value: "vies", label: "VIES"',
    `${name} deve includere VIES nella lista dei Prodotti Consentiti`,
  );
}

expectIncludes(
  inviteDialog,
  'allowed_products: selectedProducts',
  'La creazione utente deve continuare a inviare i prodotti selezionati al backend',
);
expectRegex(
  editProductsDialog,
  /practice_type:\s*productType/,
  'La modifica permessi deve continuare a persistere ogni prodotto selezionato come practice_type',
);

expectIncludes(
  dashboardLayout,
  'user_product_permissions',
  'Il menu deve leggere user_product_permissions per determinare la visibilità VIES dei non-admin',
);
expectIncludes(
  dashboardLayout,
  'canAccessVies',
  'Il menu deve usare uno stato canAccessVies per nascondere VIES agli utenti non autorizzati',
);
expectRegex(
  dashboardLayout,
  /practice_type[\s\S]{0,160}vies|vies[\s\S]{0,160}practice_type/,
  'Il menu deve controllare esplicitamente il prodotto VIES nei permessi',
);
expectRegex(
  dashboardLayout,
  /filter\([\s\S]{0,400}\/vies|\/vies[\s\S]{0,400}filter\(/,
  'Il menu deve filtrare il link /vies quando canAccessVies è falso',
);

expectIncludes(
  viesPage,
  'accessStatus',
  'La pagina VIES deve avere uno stato di autorizzazione prima di mostrare il caricamento',
);
expectIncludes(
  viesPage,
  'user_product_permissions',
  'La pagina VIES deve verificare i permessi prodotto per gli utenti non-admin',
);
expectRegex(
  viesPage,
  /practice_type[\s\S]{0,180}vies|vies[\s\S]{0,180}practice_type/,
  'La pagina VIES deve controllare esplicitamente il permesso practice_type = vies',
);
expectIncludes(
  viesPage,
  'Accesso VIES non autorizzato',
  'La pagina VIES deve mostrare un messaggio chiaro quando il permesso VIES manca',
);
expectRegex(
  viesPage,
  /if \(accessStatus !== "allowed"\)[\s\S]{0,300}return|accessStatus !== "allowed"[\s\S]{0,300}handlePrepareBatch/,
  'La preparazione batch VIES deve essere bloccata quando il permesso non è allowed',
);

if (failures.length > 0) {
  console.error('Controllo permessi prodotto VIES fallito:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Controllo permessi prodotto VIES superato.');
