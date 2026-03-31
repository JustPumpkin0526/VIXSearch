"""backend package initializer"""

# Package marker for backend; keeps imports like `backend.xxx` working
import sys
try:
	# Ensure imports that use top-level `app_config` resolve to the same package
	# when the application is run as a package (avoid duplicate module objects).
	import backend.app_config as _app_config
	sys.modules.setdefault('app_config', _app_config)
except Exception:
	pass
