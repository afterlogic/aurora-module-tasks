<?php

namespace Aurora\Modules\Tasks;

class Module extends \Aurora\System\Module\AbstractModule
{
	public function init() {
		
	}

	/**
	 * Obtains list of module settings for authenticated user.
	 * 
	 * @return array
	 */
	public function GetSettings()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\Aurora\System\Enums\UserRole::Anonymous);
		return null;
	}	
}
