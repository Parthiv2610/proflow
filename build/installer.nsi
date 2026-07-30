; ProFlow Installer
!define PRODUCT_NAME "ProFlow"
!define PRODUCT_VERSION "2.0.0"
!define PRODUCT_PUBLISHER "ProFlow"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\ProFlow.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

SetCompressor /SOLID lzma
RequestExecutionLevel admin

Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText "ProFlow"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\release\ProFlow-Setup-${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\ProFlow"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""

Section "Install"
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Copy ALL files from the portable build recursively
  File /r "..\release\ProFlow-v5\ProFlow-win32-x64\*"
  
  CreateDirectory "$SMPROGRAMS\ProFlow"
  CreateShortCut "$SMPROGRAMS\ProFlow\ProFlow.lnk" "$INSTDIR\ProFlow.exe"
  CreateShortCut "$DESKTOP\ProFlow.lnk" "$INSTDIR\ProFlow.exe"
  CreateShortCut "$SMPROGRAMS\ProFlow\Uninstall ProFlow.lnk" "$INSTDIR\Uninstall.exe"
  
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\ProFlow.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\ProFlow.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\ProFlow\ProFlow.lnk"
  Delete "$SMPROGRAMS\ProFlow\Uninstall ProFlow.lnk"
  RMDir "$SMPROGRAMS\ProFlow"
  Delete "$DESKTOP\ProFlow.lnk"
  
  RMDir /r "$INSTDIR"
  
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
SectionEnd
