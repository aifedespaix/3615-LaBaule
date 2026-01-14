import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export function DebugGL() {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.error("CRITICAL: WebGL Context Lost!");
      console.error("Possible causes: GPU driver crash, OOM, infinite loop in shader, or heavy main thread blocking.");

      // Try to get debug info if available
      // Fix: Access getContext() from the renderer to get the WebGLRenderingContext
      const context = gl.getContext();
      const debugInfo = context.getExtension('WEBGL_debug_renderer_info');

      if (debugInfo) {
        const vendor = context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        console.error(`Renderer: ${renderer} (${vendor})`);
      } else {
        console.warn("WEBGL_debug_renderer_info extension not supported.");
      }
    };

    const handleContextRestored = () => {
      console.log("RECOVERY: WebGL Context Restored.");
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [gl]);

  return null;
}
