import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const updateMobile = () => setIsMobile(mql.matches)
    
    mql.addEventListener("change", updateMobile)
    updateMobile()
    
    return () => mql.removeEventListener("change", updateMobile)
  }, [])

  return !!isMobile
}
