import os
import sys
import base64
import subprocess
import pypdf

def get_base64_image(image_path):
    if not os.path.exists(image_path):
        print(f"Warning: Image {image_path} not found.")
        return ""
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    ext = os.path.splitext(image_path)[1].lower().replace(".", "")
    if ext == "jpg": ext = "jpeg"
    return f"data:image/{ext};base64,{data}"

print("Cargando imágenes y convirtiendo a Base64...")
b64_logo = get_base64_image(os.path.join("assets", "logo_unimayor.png"))
b64_fig1 = get_base64_image("figura1_validacion_rk4_vs_analitica.png")
b64_fig2 = get_base64_image("figura2_comparativa_regimenes_amortiguamiento.png")
b64_fig3 = get_base64_image("figura3_filtrado_senal_multitono.png")
b64_fig4 = get_base64_image("figura4_diagrama_bode_filtro_audio.png")

template_path = os.path.abspath("informe_template.html")
if not os.path.exists(template_path):
    print(f"Error: No se encuentra {template_path}")
    sys.exit(1)

with open(template_path, "r", encoding="utf-8") as f:
    html_content = f.read()

# Sustitución de imágenes base64
logo_img_html = f"<img src='{b64_logo}' style='max-height: 50px; background: white; padding: 3px 6px; border-radius: 5px;'>" if b64_logo else ""
fig1_img_html = f"<img src='{b64_fig1}'>" if b64_fig1 else "<p>[Figura 1]</p>"
fig2_img_html = f"<img src='{b64_fig2}'>" if b64_fig2 else "<p>[Figura 2]</p>"
fig3_img_html = f"<img src='{b64_fig3}'>" if b64_fig3 else "<p>[Figura 3]</p>"
fig4_img_html = f"<img src='{b64_fig4}'>" if b64_fig4 else "<p>[Figura 4]</p>"

html_content = html_content.replace("__LOGO_IMG_HTML__", logo_img_html)
html_content = html_content.replace("__FIG1_IMG_HTML__", fig1_img_html)
html_content = html_content.replace("__FIG2_IMG_HTML__", fig2_img_html)
html_content = html_content.replace("__FIG3_IMG_HTML__", fig3_img_html)
html_content = html_content.replace("__FIG4_IMG_HTML__", fig4_img_html)

output_html = os.path.abspath("INFORME_COMPLETO_PROYECTO_RLC.html")
with open(output_html, "w", encoding="utf-8") as f:
    f.write(html_content)
print(f"Documento HTML generado: {output_html} ({os.path.getsize(output_html):,} bytes)")

print("Compilando PDF de alta calidad con Microsoft Edge Headless...")
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
pdf_path = os.path.abspath("INFORME_COMPLETO_PROYECTO_RLC.pdf")

cmd = [
    edge_path,
    "--headless=new",
    "--disable-gpu",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=9000",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    output_html
]

res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0 and os.path.exists(pdf_path):
    print(f"\n¡ÉXITO TOTAL! Archivo PDF generado: {pdf_path}")
    print(f"Tamaño del archivo PDF: {os.path.getsize(pdf_path):,} bytes")
    
    reader = pypdf.PdfReader(pdf_path)
    print(f"Total de páginas compiladas: {len(reader.pages)}")
    for i, p in enumerate(reader.pages):
        txt = p.extract_text()
        first_line = txt.split('\n')[0].strip() if txt else "EMPTY"
        print(f"  Página {i+1} ({len(txt)} caracteres): {first_line[:65]}...")
else:
    print(f"Error al compilar PDF: {res.stderr}")
    sys.exit(1)
