<?php
$servername = "localhost";
$username = "admin";
$password = "SLSKJDFH";
$dbname = "gameshelf";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

//Fetch gameboxes table
  $result = $conn->query("SELECT * FROM gameboxes");

//Initialize array variable
  $dbdata = array();

//Fetch into associative array
  while ( $row = $result->fetch_assoc())  {
	$dbdata[]=$row;
  }

//Create Output
echo "<center><h1>";
foreach ($dbdata as $Box){
	$Title = $Box['Title'];
	$ImageURL = "./GameBoxes/".$Title."/images/".$Box['Image'];
	$Description = $Box['Description'];
	echo $Title."<BR>";
	echo "<img src=".$ImageURL." width='200px' height='200px' ></h1>";
	echo $Description."<BR>";
}
echo "</center>";

?>