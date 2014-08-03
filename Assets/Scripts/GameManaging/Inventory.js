#pragma strict
/*******************************************************
|	Inventory Script
|
|	This script draws all the menu boxes and handles navigation
|	Versión: 1.0
|	
|	Autor: Manlio Joaquín García González <manliojoaquin@gmail.com>
|
|	Proyecto SAVEH
*******************************************************/
import System.Collections.Generic;

static class Inventory extends MonoBehaviour{
	
	var items 		: Dictionary.<String, int> = new Dictionary.<String, int>();
	var textures 	: Dictionary.<String, Texture> = new Dictionary.<String, Texture>();
	
	function Has(item:String){
		if(items.ContainsKey(item)) return true;
		else return false;
	}
	function Has(item:String, amount:int):boolean{
		if(items.ContainsKey(item)){
			if (items[item] >= amount) return true;
		}
		else return false;
		return;
	}
	
	function AddItem (item:String, amount:int){
		if ( !textures.ContainsKey( item ) )
			Server.StartCoroutine(Server.Retrieve.ItemTexture(item));
	
		if(Has(item) == true){
			var tempArray:Dictionary.<String, int> = items;
			tempArray[item] = tempArray[item] + amount;
			items = tempArray;
		}
		else {
			items.Add (item, amount);
		}
		
	}
	function AddItem (item:String){
		AddItem(item, 1);
	}
	
	function DropItem(item:String){
		AddItem(item, -1);
		var drop:GameObject = PhotonNetwork.Instantiate("Prefabs/Item", Player.position() + Vector3.forward, Quaternion.identity, 0) as GameObject;
		Server.GetPhotonView().RPC("SyncObject", PhotonTargets.AllBuffered, drop.GetComponent(PhotonView).viewID.ToString(), "drop", item);
		Server.Log("game event","Player " + Player.nickname + " dropped " + item);
		
	}
	
}