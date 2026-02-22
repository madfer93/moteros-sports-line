const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Pruebas de Categorías e Iconos', () => {
    test('debe mostrar la categoría NIÑ@S en el menú principal', async ({ page }) => {
        // Abrir el archivo index.html local
        const filePath = 'file://' + path.resolve(__dirname, '../index.html');
        await page.goto(filePath);

        // Esperar a que se carguen las categorías dinámicas
        await page.waitForSelector('#mainNav');

        // Verificar que existe un enlace con el tooltip o imagen de NIÑ@S
        const ninosLink = page.locator('a[title="NIÑ@S"], a img[alt="Niñ@s"]');
        await expect(ninosLink.first()).toBeVisible();
    });

    test('debe mostrar el icono de multiproposito para la subcategoría CROSS en el catálogo', async ({ page }) => {
        const filePath = 'file://' + path.resolve(__dirname, '../catalogo.html?categoria=Cascos');
        await page.goto(filePath);

        // Esperar a que se carguen las subcategorías visuales
        await page.waitForSelector('.categoria-visual-item');

        // Buscar el item de CROSS y verificar su imagen
        const crossImg = page.locator('.categoria-visual-item:has-text("CROSS") img');
        await expect(crossImg).toHaveAttribute('src', 'img/icons/multiproposito.png');
    });
});
