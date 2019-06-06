
DEFAULTTESTTIMEOUT=8000

.PHONY: .FORCE

include ./wovtoolscheat.mk
# NOTE: example ./wovtoolscheats.mk is:
#> POSTGRES_PASSWORD=password
#> WOV_wstests_port=3007
#> ENVS=WOV_STAGE=cw WOV_ME=cw WOV_PROJECT=wstests \
#>   WOV_apidb_username=postgres WOV_apidb_host=localhost WOV_apidb_database=wov WOV_apidb_password=${POSTGRES_PASSWORD} \
#>   WOV_apidb_port=5432 WOV_apidb_type=postgres WOV_apimatch_port=${WOV_apimatch_port}

all:


test : .FORCE
	if [ -e "dist" ]; then \
		cd dist ; ${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}; \
		else \
		${ENVS} mocha -b $$TEST --timeout ${DEFAULTTESTTIMEOUT}; \
  fi
