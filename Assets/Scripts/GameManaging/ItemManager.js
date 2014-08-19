﻿#pragma strict
#pragma downcast
// It enables or disables the items on the map.
// Version: 2.1
//
// Changes in 2.1 version:
//	-	Storage of an array of available PhotonView ids.
//	-	Synchronization of drop item.
//
// Changes in 2.0 version:
//	-	This script retrieves information from a database and
//		instantiates the items this way.
//	-	The hash of items is not used.
//	-	We can remove items from the database.
//	-	Database synchronization.
//
// Autor: Rodrigo Valladares Santana <rodriv_tf@hotmail.com> 

import System.Xml;

// The ID of the items on the scene must be betweeon 100 and 199
public static final var MinItemID = 100;
public static final var MaxItemID = 199;

// If it's setted true, the changes in scene items will sync with database.
public var sceneItemsPersistence : boolean;

// If it's setted true, the changes in the inventory will sync with database.
public var inventoryPersistence : boolean;

// Acces to non-static members by static functions.
private static var instance : ItemManager;

// It stores if a PhotonView id is available for an item or not
private static var availablePhotonViewIDs : boolean[] = new boolean[MaxItemID - MinItemID];

// This method checks the validity of the id (is in range)
public static function IsIDInRange(id : int) : boolean {
	return (id >= MinItemID) && (id <= MaxItemID);
}

// This method checks if an ID is available (it is not being used by another item)
public static function IsIDAvailable(id : int) : boolean {
	return IsIDInRange(id) && (availablePhotonViewIDs[id - MinItemID]);
}

// This method checks if an ID is available (it is being used by another item)
public static function IsIDReserved(id : int) : boolean {
	return IsIDInRange(id) && (!availablePhotonViewIDs[id - MinItemID]);
}

// It returns the first PhotonView id that is avaible to use
private static function GetFirstAvailablePhotonViewID() : int {
	var id : int = 0;
	while((id < availablePhotonViewIDs.Length) && (!availablePhotonViewIDs[id])) {
		id++;
	}
	return id + MinItemID;
}

private static function ReservePhotonViewID(id : int) {
	availablePhotonViewIDs[id - MinItemID] = false;
}

private static function FreePhotonViewID(id : int) {
	availablePhotonViewIDs[id - MinItemID] = true;
}

function Awake() {
	instance = this;
}

function Start () {
	// Initialization of availablePhotonViewIDs
	for(var i : int = 0; i < availablePhotonViewIDs.Length; i++) {
		availablePhotonViewIDs[i] = true;
	}
	StartCoroutine(RetrieveItemInformation());
	if(!sceneItemsPersistence) {
		Debug.LogError("Scene items changes won't sync. Please set sceneItemsPersistence true.");
	}
	if(!inventoryPersistence) {
		Debug.LogError("Inventory changes won't sync. Please set inventoryPersistence true.");
	}
}

// This retrieves the data of the items on the current scene and
// instantiates them.
private function RetrieveItemInformation() : IEnumerator {
	// TODO Hacer esto solo si es el primer usuario en la escena
	var url : String = Paths.GetSceneQuery() + "/get_items.php/?scene=" + 
						(LevelManager.GetCurrentScene() != null ? LevelManager.GetCurrentScene() : "Main");
	Debug.Log(url);
	var www : WWW = new WWW(url);
	while(!www.isDone) {
		yield;
	}
	Debug.Log(www.text);
	var xDoc : XmlDocument = new XmlDocument();
	xDoc.LoadXml(www.text);
	var result : XmlNodeList = xDoc.GetElementsByTagName("result");
	var resultElement = result[0] as XmlElement;
	var row : XmlNodeList = resultElement.ChildNodes;
	var id : int;
	var x : float;
	var y : float;
	var z : float;
	var texture : String;
	while(PhotonNetwork.room == null) {
		yield;
	}
	if(row.Count > 0) {
		for(var rowElement : XmlElement in row) {
			id = int.Parse(rowElement.GetElementsByTagName("id")[0].InnerText);
			x = float.Parse(rowElement.GetElementsByTagName("x")[0].InnerText);
			y = float.Parse(rowElement.GetElementsByTagName("y")[0].InnerText);
			z = float.Parse(rowElement.GetElementsByTagName("z")[0].InnerText);
			texture = rowElement.GetElementsByTagName("texture")[0].InnerText;
			Debug.Log("id = " + id + ", x = " + x + ", y = " + y + ", z = " + z + ", texture = " + texture);
			InstantiateItem(id, x, y, z, texture);
		}
	} else {
		Debug.Log("There are no items on scene " + LevelManager.GetCurrentScene());
	}
}

// Instantiation of an item in a scene
private static function InstantiateItem(id : int, x : float, y : float, z : float, texture : String) : GameObject {
	var item : GameObject = null;
	if(IsIDAvailable(id)) {
		item = PhotonNetwork.Instantiate("Prefabs/item", new Vector3(x, y, z), new Quaternion(90, 0, 0, 0), 0) as GameObject;
		item.name = texture;
		instance.StartCoroutine((item.GetComponent("Item") as Item).SetTexture(texture));
		(item.GetComponent("PhotonView") as PhotonView).viewID = id;
		ReservePhotonViewID(id);
	} else {
		Debug.LogError("Bad id = " + id);
	}
	return item;
}

// This adds an item to the scene and syncs it.
public static function AddItemToScene(item : String, scene : String, position : Vector3) {
	var id : int = GetFirstAvailablePhotonViewID();
	var texture : String = item;
	var x : float = position.x;
	var y : float = position.y;
	var z : float = position.z;
	var object : GameObject = InstantiateItem(id, x, y, z, texture);
	
	if(object != null) {
		if(instance.sceneItemsPersistence) {
			var url : String = Paths.GetSceneQuery() + "/add_item.php/?id=" + id + "&scene=" + scene
								+ "&texture=" + texture + "&x=" + x + "&y=" + y + "&z=" + z;
			var www : WWW = new WWW(url);
			while(!www.isDone) {
				yield;
			}
			if(!www.text.Equals("OK")) {
				Debug.LogError("Error syncing adding item to scene (" + www.text + ") url = " + url);
			}
		}
	} else {
		Debug.LogError("Error adding item to scene");
	}
}

// This removes an item from a scene. 
public static function RemoveItemFromScene(item : Item, scene : String) {
	var id : int = item.GetPhotonViewID();
	// We check if the id is being used by the item
	if(IsIDReserved(id)) {
		if(instance.sceneItemsPersistence) {
			var url : String = Paths.GetSceneQuery() + "/delete_item.php/?id=" + id + "&scene=" + scene;
			Debug.Log(url);
			var www : WWW = new WWW(url);
			while(!www.isDone) {
				yield;
			}
			if(!www.text.Equals("OK")) {
				Debug.LogError("Error deleting item " + id + " from scene " + scene + " on the database (" 
								+ www.text + ") url = " + url);
			} else {
				FreePhotonViewID(id);
			}
		}
		PhotonNetwork.Destroy(item.gameObject);
	} else {
		Debug.LogError("Bad id = " + id + " Check synchronization!");
	}
}

// Syncs the amount of items
// Adds an amount of items to the original amount of items
public static function SyncAddItem(item : String, amount : int) {
	if(instance.inventoryPersistence) {
		var url : String = Paths.GetPlayerQuery() + "/add_item.php/?player=" + Player.nickname + "&item=" + item + "&amount=" + amount;
		var www : WWW = new WWW(url);
		while(!www.isDone) {
			yield;
		}
		if(!www.text.Equals("OK")) {
			Debug.LogError("Error syncing item " + item + " with the database (" + www.text + ") url = " + url);
		}
	}
	Inventory.AddItem(item, amount);
}