import { Level } from "level";

export default class levelDatabase
{
	constructor ( leveldb )
	{
		this.db = leveldb;
	}

	async batch ( batch )
	{
		if ( batch.length === 0 )
		{
			return;
		}
		await this.db.batch( batch );
	}

	async clear ()
	{
		await this.db.clear();
	}

	async close ()
	{
		await this.db.close();
	}

	async get ( key )
	{
		try
		{
			const value = await this.db.get( key );
			return value;
		}
		catch ( error )
		{
			if ( error.code === "LEVEL_NOT_FOUND" )
			{
				console.log( `Key ${key} not found` );
				return null;
			}
			throw error;
		}
	}

	async put ( key, value )
	{
		await this.db.put( key, value );
	}

	async delete ( key )
	{
		try
		{
			await this.db.del( key );
		}
		catch ( error )
		{
			if ( error.code === "LEVEL_NOT_FOUND" )
			{
				console.log( `Key ${key} not found for deletion` );
			}
			else
			{
				throw error;
			}
		}
	}

	async exists ( key )
	{
		try
		{
			await this.db.get( key );
			return true;
		}
		catch ( error )
		{
			if ( error.code === "LEVEL_NOT_FOUND" )
			{
				return false;
			}
			throw error;
		}
	}

	async all ()
	{
		const iterator = this.db.iterator();
		const entries = await iterator.all();
		return Object.fromEntries( entries );
	}

	// Retrieve a range of data based on keys
	async range ( options = {})
	{
		const iterator = this.db.iterator( options );
		const entries = await iterator.all();
		return Object.fromEntries( entries );
	}

	// Generate a new sublevel (useful for specific namespaces like wallet)
	sublevel ( name, options = { valueEncoding: "json" })
	{
		return this.db.sublevel( name, options );
	}
}
