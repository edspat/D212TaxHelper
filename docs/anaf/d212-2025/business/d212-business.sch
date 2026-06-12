<pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="business">
  <!-- versiunea v1.0.1 din 24.02.2026 corecteaza regulile BR-D212-0001, BR-D212-0002 si BR-D212-0076 pentru validarea cnp care incep cu 6,7,8,9--> 
  <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
  <!-- Conține reguli: 
    BR-D212-0001 … BR-D212-0016 + BR-D212-0076
  -->

  <title>D212 – Business validation</title>

  <!--
  <rule context="/*">
    <assert test="false()" id="DBG-ROOT">
      [DEBUG ROOT] Rule business a fost executata pe elementul <value-of select="name(.)"/>.
    </assert>
  </rule>

  <rule context="//@cif">
    <assert test="false()" flag="warning" id="DBG-ALIVE">
      [DEBUG] Sunt pe atributul <value-of select="name(.)"/>
      cu valoarea "<value-of select="."/>"
    </assert>
  </rule>
  -->

  <!-- Regula: bifa_optiune = 1  <=>  baza_optiune completat(ă) si = 24300 -->
  <!-- (mutat pe context de atribut ca sa nu se suprapuna cu alte reguli pe element) -->
  <rule context="//@bifa_optiune | //@baza_optiune">

    <!-- descrieri din XSD -->
    <let name="desc_bifa"
         value="$schema//xs:attribute[@name='bifa_optiune']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_baza"
         value="$schema//xs:attribute[@name='baza_optiune']/xs:annotation/xs:documentation[1]"/>

    <!-- valori normalizate (de pe elementul parinte) -->
    <let name="bifa" value="normalize-space(../@bifa_optiune)"/>
    <let name="baza" value="normalize-space(../@baza_optiune)"/>

    <!-- flag completare + verificare 24300 -->
    <let name="hasBaza" value="string-length($baza) &gt; 0"/>
    <let name="is24300" value="$hasBaza and number($baza) = 24300"/>

    <!-- echivalenta:
         - daca bifa = '1'  => baza exista si = 24300
         - daca bifa != '1' => baza necompletata -->
    <let name="isValid"
         value="( $bifa = '1' and $is24300 )
               or
               ( $bifa != '1' and not($hasBaza) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0016">
      [BR-D212-0016]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      si atributul
      <value-of select="if (normalize-space($desc_baza) != '') then $desc_baza else 'baza_optiune'"/>
      (baza_optiune)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_baza) != '') then $desc_baza else 'baza_optiune'"/>
      (baza_optiune)
      trebuie sa fie completat(ă) si sa aiba valoarea 24300,
      iar daca
      <value-of select="if (normalize-space($desc_baza) != '') then $desc_baza else 'baza_optiune'"/>
      (baza_optiune)
      este completat(ă) si are valoarea 24300, atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- Regula: daca este completat, @cnpCoasigurat trebuie sa fie
       (1) unic intre toti coasiguratii
       (2) diferit de valoarea atributului @cif de pe radacina
       + (3) CNP valid (BR-D212-0014) -->
  <rule context="//@cnpCoasigurat">

    <let name="attName" value="name(.)"/>

    <let name="desc"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="label" value="normalize-space($desc)"/>

    <let name="val" value="normalize-space(.)"/>
    <let name="hasVal" value="string-length($val) &gt; 0"/>

    <let name="cifRoot" value="normalize-space(/*/@cif)"/>

    <let name="cntCoas"
         value="count(//@cnpCoasigurat[normalize-space(.) = $val])"/>

    <let name="isValidUniq"
         value="not($hasVal) or ($cntCoas = 1 and not($val = $cifRoot))"/>

    <assert test="$isValidUniq" flag="fatal" id="BR-D212-0014">
      [BR-D212-0014]
      <value-of select="if (normalize-space($label) != '') then $label else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      , daca este completat,
      trebuie sa aiba o valoare unica intre toate atributele cnpCoasigurat
      din formular si nu trebuie sa coincida cu valoarea atributului cif
      de pe elementul radacina.
    </assert>
    <!-- ========================= -->
    <!-- BR-D212-0076 – cnp_coasigurat CNP valid -->
    <!-- (NaN-safe cross-engine)  -->
    <!-- ========================= -->
    
    <let name="cnp_coasigurat" value="normalize-space(.)"/>
    <let name="len_coasigurat" value="string-length($cnp_coasigurat)"/>
    
    <!-- Pozitia coasiguratului curent -->
    <let name="currentParent" value=".."/>
    <let name="coasPos"
      value="count($currentParent/preceding-sibling::*[name() = name($currentParent)]) + 1"/>
    
    <!-- gol => OK -->
    <let name="isEmpty" value="$len_coasigurat = 0"/>
    
    <!-- doar cifre -->
    <let name="allDigits" value="translate($cnp_coasigurat, '0123456789', '') = ''"/>
    
    <!-- format strict cnp_coasigurat: 13 cifre, prima != 0 -->
    <let name="hasBasicFormat"
      value="$len_coasigurat = 13 and $allDigits and substring($cnp_coasigurat, 1, 1) != '0'"/>
    
    <!-- dacă nu are format strict, NU intrăm în calcule numerice -->
    <let name="doCalc" value="$hasBasicFormat"/>
    
    <!-- cifre d1..d13 (evaluate doar când doCalc=true; altfel devin 0, fără NaN) -->
    <let name="d1"  value="number(substring($cnp_coasigurat, 1, 1)) * number($doCalc)"/>
    <let name="d2"  value="number(substring($cnp_coasigurat, 2, 1)) * number($doCalc)"/>
    <let name="d3"  value="number(substring($cnp_coasigurat, 3, 1)) * number($doCalc)"/>
    <let name="d4"  value="number(substring($cnp_coasigurat, 4, 1)) * number($doCalc)"/>
    <let name="d5"  value="number(substring($cnp_coasigurat, 5, 1)) * number($doCalc)"/>
    <let name="d6"  value="number(substring($cnp_coasigurat, 6, 1)) * number($doCalc)"/>
    <let name="d7"  value="number(substring($cnp_coasigurat, 7, 1)) * number($doCalc)"/>
    <let name="d8"  value="number(substring($cnp_coasigurat, 8, 1)) * number($doCalc)"/>
    <let name="d9"  value="number(substring($cnp_coasigurat, 9, 1)) * number($doCalc)"/>
    <let name="d10" value="number(substring($cnp_coasigurat,10, 1)) * number($doCalc)"/>
    <let name="d11" value="number(substring($cnp_coasigurat,11, 1)) * number($doCalc)"/>
    <let name="d12" value="number(substring($cnp_coasigurat,12, 1)) * number($doCalc)"/>
    <let name="d13" value="number(substring($cnp_coasigurat,13, 1)) * number($doCalc)"/>
    
    <let name="sum"
      value="$d1  * 2 +
      $d2  * 7 +
      $d3  * 9 +
      $d4  * 1 +
      $d5  * 4 +
      $d6  * 6 +
      $d7  * 3 +
      $d8  * 5 +
      $d9  * 8 +
      $d10 * 2 +
      $d11 * 7 +
      $d12 * 9"/>
    
    <let name="mod" value="$sum mod 11"/>
    
    <!-- expected = mod, iar dacă mod=10 => 1 -->
    <let name="expected"
      value="(number($mod != 10) * $mod) + (number($mod = 10) * 1)"/>
    
    <let name="checksumOK" value="$doCalc and ($d13 = $expected)"/>
    
    <!-- ================================ -->
    <!-- OPTIMIZARE: 7/8/9 => doar checksum -->
    <!-- ================================ -->
    
    <!-- prefix (de aici in jos controlam extra-validarile) -->
    <let name="prefix" value="substring($cnp_coasigurat, 1, 1)"/>
    <let name="isForeignPrefix" value="$prefix = '7' or $prefix = '8' or $prefix = '9'"/>
    <let name="doExtra" value="$doCalc and not($isForeignPrefix)"/>
    
    <!-- judet: 01–52, 70, 80 (doar cand doExtra=true; altfel 0) -->
    <let name="judet" value="number(substring($cnp_coasigurat, 8, 2)) * number($doExtra)"/>
    <let name="judetOK"
      value="$doExtra
      and
      ( ($judet &gt;= 1 and $judet &lt;= 52)
      or $judet = 70
      or $judet = 80 )"/>
    
    <!-- luna/zi (doar cand doExtra=true; altfel 0) -->
    <let name="luna" value="number(substring($cnp_coasigurat, 4, 2)) * number($doExtra)"/>
    <let name="ziua" value="number(substring($cnp_coasigurat, 6, 2)) * number($doExtra)"/>
    
    <let name="dataOK"
      value="$doExtra and (
      (
      ($luna = 1 or $luna = 3 or $luna = 5 or $luna = 7 or $luna = 8 or $luna = 10 or $luna = 12)
      and $ziua &gt;= 1 and $ziua &lt;= 31
      )
      or
      (
      ($luna = 4 or $luna = 6 or $luna = 9 or $luna = 11)
      and $ziua &gt;= 1 and $ziua &lt;= 30
      )
      or
      (
      $luna = 2
      and $ziua &gt;= 1 and $ziua &lt;= 29
      )
      )"/>
    
    <!-- an 1800–2099 (doar cand doExtra=true; altfel 0) -->
    <let name="aa" value="number(substring($cnp_coasigurat, 2, 2)) * number($doExtra)"/>
    
    <let name="an"
      value="
      number($doExtra) * (
      number($prefix = '1' or $prefix = '2') * (1900 + $aa)
      + number($prefix = '3' or $prefix = '4') * (1800 + $aa)
      + number($prefix = '5' or $prefix = '6') * (2000 + $aa)
      )
      "/>
    
    <let name="anOK" value="$doExtra and $an &gt;= 1800 and $an &lt;= 2099"/>
    
    <!-- VALIDARE FINALĂ:
     - daca prefix = 7,8,9 → doar checksum
     - altfel → checksum + judet + data + an
-->
    <let name="isValidcnp_coasigurat"
      value="
      $isEmpty
      or
      (
      $doCalc
      and
      (
      ( $isForeignPrefix and $checksumOK )
      or
      ( not($isForeignPrefix) and $checksumOK and $judetOK and $dataOK and $anOK )
      )
      )
      "/>
    
    <assert test="$isValidcnp_coasigurat" flag="fatal" id="BR-D212-0076">
      [BR-D212-0076]
      Codul Numeric Personal al coasiguratului nr. <value-of select="$coasPos"/> (<value-of select="$cnp_coasigurat"/>) nu este valid.
      <value-of select="$label"/>
      <value-of select="substring(' ', 1, string-length($label))"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa contina un CNP valid
      (exact 13 cifre; cifra de control conform algoritmului;
      pentru prefix 1–6 se verifica suplimentar data/judet/an,
      iar pentru prefix 7/8/9 se verifica doar cifra de control).
    </assert>
   
    

  </rule>

  <!-- Regula: daca este completat, @cif trebuie sa fie unic in tot formularul
       + CNP valid (BR-D212-0013) pentru @cif -->
  <rule context="//@cif">

    <let name="attName" value="name(.)"/>

    <let name="desc"
         value="$schema//xs:attribute[@name = 'cif']/xs:annotation/xs:documentation[1]"/>
    <let name="label" value="normalize-space($desc)"/>

    <let name="val" value="normalize-space(.)"/>
    <let name="hasVal" value="string-length($val) &gt; 0"/>

    <let name="cnt"
         value="count(
           //@*[
             (name() = 'cif' or name() = 'cnpCoasigurat' or name() = 'cif_i')
             and normalize-space(.) = $val
           ]
         )"/>

    <let name="isValidUniq" value="not($hasVal) or ($cnt = 1)"/>

    <assert test="$isValidUniq" flag="fatal" id="BR-D212-0013">
      [BR-D212-0013]
      <value-of select="if (normalize-space($label) != '') then $label else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      , daca este completat,
      trebuie sa aiba o valoare unica in formular
      (aceeasi valoare nu trebuie sa mai apara la cnpCoasigurat sau cif_i).
    </assert>

    <!-- ========================= -->
    <!-- BR-D212-0001 – CNP valid -->
    <!-- (NaN-safe cross-engine)  -->
    <!-- ========================= -->
    
    
    
    <let name="attName" value="name(.)"/>
    
    <let name="desc"
      value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="label" value="normalize-space($desc)"/>
    
    <let name="cnp" value="normalize-space(.)"/>
    <let name="len" value="string-length($cnp)"/>
    
    <!-- gol => OK -->
    <let name="isEmpty" value="$len = 0"/>
    
    <!-- doar cifre -->
    <let name="allDigits" value="translate($cnp, '0123456789', '') = ''"/>
    
    <!-- format strict CNP: 13 cifre, prima != 0 -->
    <let name="hasBasicFormat"
      value="$len = 13 and $allDigits and substring($cnp, 1, 1) != '0'"/>
    
    <!-- dacă nu are format strict, NU intrăm în calcule numerice -->
    <let name="doCalc" value="$hasBasicFormat"/>
    
    <!-- cifre d1..d13 (evaluate doar când doCalc=true; altfel devin 0, fără NaN) -->
    <let name="d1"  value="number(substring($cnp, 1, 1)) * number($doCalc)"/>
    <let name="d2"  value="number(substring($cnp, 2, 1)) * number($doCalc)"/>
    <let name="d3"  value="number(substring($cnp, 3, 1)) * number($doCalc)"/>
    <let name="d4"  value="number(substring($cnp, 4, 1)) * number($doCalc)"/>
    <let name="d5"  value="number(substring($cnp, 5, 1)) * number($doCalc)"/>
    <let name="d6"  value="number(substring($cnp, 6, 1)) * number($doCalc)"/>
    <let name="d7"  value="number(substring($cnp, 7, 1)) * number($doCalc)"/>
    <let name="d8"  value="number(substring($cnp, 8, 1)) * number($doCalc)"/>
    <let name="d9"  value="number(substring($cnp, 9, 1)) * number($doCalc)"/>
    <let name="d10" value="number(substring($cnp,10, 1)) * number($doCalc)"/>
    <let name="d11" value="number(substring($cnp,11, 1)) * number($doCalc)"/>
    <let name="d12" value="number(substring($cnp,12, 1)) * number($doCalc)"/>
    <let name="d13" value="number(substring($cnp,13, 1)) * number($doCalc)"/>
    
    <let name="sum"
      value="$d1  * 2 +
      $d2  * 7 +
      $d3  * 9 +
      $d4  * 1 +
      $d5  * 4 +
      $d6  * 6 +
      $d7  * 3 +
      $d8  * 5 +
      $d9  * 8 +
      $d10 * 2 +
      $d11 * 7 +
      $d12 * 9"/>
    
    <let name="mod" value="$sum mod 11"/>
    
    <!-- expected = mod, iar dacă mod=10 => 1 -->
    <let name="expected"
      value="(number($mod != 10) * $mod) + (number($mod = 10) * 1)"/>
    
    <let name="checksumOK" value="$doCalc and ($d13 = $expected)"/>
    
    <!-- ================================ -->
    <!-- OPTIMIZARE: 7/8/9 => doar checksum -->
    <!-- ================================ -->
    
    <!-- prefix (de aici in jos controlam extra-validarile) -->
    <let name="prefix" value="substring($cnp, 1, 1)"/>
    <let name="isForeignPrefix" value="$prefix = '7' or $prefix = '8' or $prefix = '9'"/>
    <let name="doExtra" value="$doCalc and not($isForeignPrefix)"/>
    
    <!-- judet: 01–52, 70, 80 (doar cand doExtra=true; altfel 0) -->
    <let name="jVal" value="number(substring($cnp, 8, 2)) * number($doExtra)"/>
    <let name="judetOK"
      value="$doExtra and ( ($jVal &gt;= 1 and $jVal &lt;= 52) or $jVal = 70 or $jVal = 80 )"/>
    
    <!-- luna/zi (doar cand doExtra=true; altfel 0) -->
    <let name="luna" value="number(substring($cnp, 4, 2)) * number($doExtra)"/>
    <let name="ziua" value="number(substring($cnp, 6, 2)) * number($doExtra)"/>
    
    <let name="dataOK"
      value="$doExtra and (
      (
      ($luna = 1 or $luna = 3 or $luna = 5 or $luna = 7 or $luna = 8 or $luna = 10 or $luna = 12)
      and $ziua &gt;= 1 and $ziua &lt;= 31
      )
      or
      (
      ($luna = 4 or $luna = 6 or $luna = 9 or $luna = 11)
      and $ziua &gt;= 1 and $ziua &lt;= 30
      )
      or
      (
      $luna = 2
      and $ziua &gt;= 1 and $ziua &lt;= 29
      )
      )"/>
    
    <!-- an 1800–2099 (doar cand doExtra=true; altfel 0) -->
    <let name="aa" value="number(substring($cnp, 2, 2)) * number($doExtra)"/>
    
    <let name="an"
      value="
      number($doExtra) * (
      number($prefix = '1' or $prefix = '2') * (1900 + $aa)
      + number($prefix = '3' or $prefix = '4') * (1800 + $aa)
      + number($prefix = '5' or $prefix = '6') * (2000 + $aa)
      )
      "/>
    
    <let name="anOK" value="$doExtra and $an &gt;= 1800 and $an &lt;= 2099"/>
    
    <!-- VALIDARE FINALĂ:
       - daca prefix = 7,8,9 → doar checksum
       - altfel → checksum + judet + data + an
  -->
    <let name="isValidCNP"
      value="
      $isEmpty
      or
      (
      $doCalc
      and
      (
      ( $isForeignPrefix and $checksumOK )
      or
      ( not($isForeignPrefix) and $checksumOK and $judetOK and $dataOK and $anOK )
      )
      )
      "/>
    
    <assert test="$isValidCNP"
      flag="fatal"
      id="BR-D212-0001">
      [BR-D212-0001]
      Codul de identificare fiscala (<value-of select="$cnp"/>) nu este valid.
      <value-of select="$label"/>
      <value-of select="substring(' ', 1, string-length($label))"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa contina un cod de identificare fiscala valid
      (exact 13 cifre; cifra de control conform algoritmului;
      pentru prefix 1–6 se verifica suplimentar data/judet/an,
      iar pentru prefix 7/8/9 se verifica doar cifra de control).
    </assert>
    
   </rule>

  <!-- Regula: cif_i = CNP valid sau CUI valid (XPath 1.0) -->
  <rule context="//@*[name() = 'cif_i']">
    
    <let name="attName" value="name(.)"/>
    
    <let name="desc"
      value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="label" value="normalize-space($desc)"/>
    
    <let name="val" value="normalize-space(.)"/>
    <let name="len" value="string-length($val)"/>
    
    <!-- gol => OK -->
    <let name="isEmpty" value="$len = 0"/>
    
    <let name="allDigits" value="translate($val, '0123456789', '') = ''"/>
    <let name="first" value="substring($val, 1, 1)"/>
    
    <!-- ========================== -->
    <!-- RAMURA CNP (13 cifre)      -->
    <!-- ========================== -->
    
    <let name="hasCNPFormat" value="$len = 13 and $allDigits and $first != '0'"/>
    <let name="doCnpCalc" value="$hasCNPFormat"/>
    
    <!-- cifre CNP d1..d13 (NaN-safe) -->
    <let name="d1"  value="number(substring($val, 1, 1)) * number($doCnpCalc)"/>
    <let name="d2"  value="number(substring($val, 2, 1)) * number($doCnpCalc)"/>
    <let name="d3"  value="number(substring($val, 3, 1)) * number($doCnpCalc)"/>
    <let name="d4"  value="number(substring($val, 4, 1)) * number($doCnpCalc)"/>
    <let name="d5"  value="number(substring($val, 5, 1)) * number($doCnpCalc)"/>
    <let name="d6"  value="number(substring($val, 6, 1)) * number($doCnpCalc)"/>
    <let name="d7"  value="number(substring($val, 7, 1)) * number($doCnpCalc)"/>
    <let name="d8"  value="number(substring($val, 8, 1)) * number($doCnpCalc)"/>
    <let name="d9"  value="number(substring($val, 9, 1)) * number($doCnpCalc)"/>
    <let name="d10" value="number(substring($val,10, 1)) * number($doCnpCalc)"/>
    <let name="d11" value="number(substring($val,11, 1)) * number($doCnpCalc)"/>
    <let name="d12" value="number(substring($val,12, 1)) * number($doCnpCalc)"/>
    <let name="d13" value="number(substring($val,13, 1)) * number($doCnpCalc)"/>
    
    <let name="sumCnp"
      value="$d1  * 2 +
      $d2  * 7 +
      $d3  * 9 +
      $d4  * 1 +
      $d5  * 4 +
      $d6  * 6 +
      $d7  * 3 +
      $d8  * 5 +
      $d9  * 8 +
      $d10 * 2 +
      $d11 * 7 +
      $d12 * 9"/>
    
    <let name="modCnp" value="$sumCnp mod 11"/>
    <let name="expectedCnp"
      value="(number($modCnp != 10) * $modCnp) + (number($modCnp = 10) * 1)"/>
    
    <let name="checksumCnpOK" value="$doCnpCalc and ($d13 = $expectedCnp)"/>
    
    <!-- ================================ -->
    <!-- OPTIMIZARE: 7/8/9 => doar checksum -->
    <!-- ================================ -->
    
    <let name="prefix" value="substring($val, 1, 1)"/>
    <let name="isForeignPrefix" value="$prefix = '7' or $prefix = '8' or $prefix = '9'"/>
    <let name="doExtra" value="$doCnpCalc and not($isForeignPrefix)"/>
    
    <!-- judet: 01–52, 70, 80 (doar cand doExtra=true; altfel 0) -->
    <let name="jVal" value="number(substring($val, 8, 2)) * number($doExtra)"/>
    <let name="judetOK"
      value="$doExtra and ( ($jVal &gt;= 1 and $jVal &lt;= 52) or $jVal = 70 or $jVal = 80 )"/>
    
    <!-- luna / zi (doar cand doExtra=true; altfel 0) -->
    <let name="luna" value="number(substring($val, 4, 2)) * number($doExtra)"/>
    <let name="ziua" value="number(substring($val, 6, 2)) * number($doExtra)"/>
    
    <let name="dataOK"
      value="$doExtra and (
      (
      ($luna = 1 or $luna = 3 or $luna = 5 or $luna = 7 or $luna = 8 or $luna = 10 or $luna = 12)
      and $ziua &gt;= 1 and $ziua &lt;= 31
      )
      or
      (
      ($luna = 4 or $luna = 6 or $luna = 9 or $luna = 11)
      and $ziua &gt;= 1 and $ziua &lt;= 30
      )
      or
      (
      $luna = 2
      and $ziua &gt;= 1 and $ziua &lt;= 29
      )
      )"/>
    
    <!-- an 1800–2099 (doar cand doExtra=true; altfel 0) -->
    <let name="aa" value="number(substring($val, 2, 2)) * number($doExtra)"/>
    
    <let name="an"
      value="
      number($doExtra) * (
      number($prefix = '1' or $prefix = '2') * (1900 + $aa)
      + number($prefix = '3' or $prefix = '4') * (1800 + $aa)
      + number($prefix = '5' or $prefix = '6') * (2000 + $aa)
      )
      "/>
    
    <let name="anOK" value="$doExtra and $an &gt;= 1800 and $an &lt;= 2099"/>
    
    <!-- VALIDARE FINALĂ:
       - daca prefix = 7,8,9 → doar checksum
       - altfel → checksum + judet + data + an
  -->
    <let name="isValidCNP"
      value="
      $isEmpty
      or
      (
      $doCnpCalc
      and
      (
      ( $isForeignPrefix and $checksumCnpOK )
      or
      ( not($isForeignPrefix) and $checksumCnpOK and $judetOK and $dataOK and $anOK )
      )
      )
      "/>
    
    <!-- ========================== -->
    <!-- RAMURA CUI (2–10 cifre)    -->
    <!-- ========================== -->
    
    <let name="isCuiCandidate"
      value="$len &gt;= 2 and $len &lt;= 10 and $allDigits and $first != '0'"/>
    
    <let name="doCuiCalc" value="$isCuiCandidate"/>
    
    <let name="n" value="($len - 1) * number($doCuiCalc)"/>
    
    <!-- cifre a1..a9 (fallback 0, NaN-safe prin concat + doCuiCalc) -->
    <let name="a1" value="number(concat('0', substring($val, 1, 1))) * number($doCuiCalc)"/>
    <let name="a2" value="number(concat('0', substring($val, 2, 1))) * number($doCuiCalc)"/>
    <let name="a3" value="number(concat('0', substring($val, 3, 1))) * number($doCuiCalc)"/>
    <let name="a4" value="number(concat('0', substring($val, 4, 1))) * number($doCuiCalc)"/>
    <let name="a5" value="number(concat('0', substring($val, 5, 1))) * number($doCuiCalc)"/>
    <let name="a6" value="number(concat('0', substring($val, 6, 1))) * number($doCuiCalc)"/>
    <let name="a7" value="number(concat('0', substring($val, 7, 1))) * number($doCuiCalc)"/>
    <let name="a8" value="number(concat('0', substring($val, 8, 1))) * number($doCuiCalc)"/>
    <let name="a9" value="number(concat('0', substring($val, 9, 1))) * number($doCuiCalc)"/>
    
    <let name="sumCui"
      value="
      number($n = 1) * ($a1 * 2)
      + number($n = 2) * ($a2 * 2 + $a1 * 3)
      + number($n = 3) * ($a3 * 2 + $a2 * 3 + $a1 * 5)
      + number($n = 4) * ($a4 * 2 + $a3 * 3 + $a2 * 5 + $a1 * 7)
      + number($n = 5) * ($a5 * 2 + $a4 * 3 + $a3 * 5 + $a2 * 7 + $a1 * 1)
      + number($n = 6) * ($a6 * 2 + $a5 * 3 + $a4 * 5 + $a3 * 7 + $a2 * 1 + $a1 * 2)
      + number($n = 7) * ($a7 * 2 + $a6 * 3 + $a5 * 5 + $a4 * 7 + $a3 * 1 + $a2 * 2 + $a1 * 3)
      + number($n = 8) * ($a8 * 2 + $a7 * 3 + $a6 * 5 + $a5 * 7 + $a4 * 1 + $a3 * 2 + $a2 * 3 + $a1 * 5)
      + number($n = 9) * ($a9 * 2 + $a8 * 3 + $a7 * 5 + $a6 * 7 + $a5 * 1 + $a4 * 2 + $a3 * 3 + $a2 * 5 + $a1 * 7)
      "/>
    
    <let name="modCui" value="($sumCui * 10) mod 11"/>
    <let name="expectedCui" value="$modCui - 10 * number($modCui = 10)"/>
    
    <let name="controlDigitCui"
      value="number(substring($val, $len, 1)) * number($doCuiCalc)"/>
    
    <let name="isValidCUI"
      value="$doCuiCalc and ($controlDigitCui = $expectedCui)"/>
    
    <!-- VALIDARE GLOBALA -->
    <let name="isValid" value="$isEmpty or $isValidCNP or $isValidCUI"/>
    
    <assert test="$isValid" flag="fatal" id="BR-D212-0002">
      [BR-D212-0002]
      Cod de identificare fiscala imputernicit (<value-of select="$val"/>) nu este valid.
      <value-of select="$label"/>
      <value-of select="substring(' ', 1, string-length($label))"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa contina fie un CNP valid
      (exact 13 cifre; cifra de control conform algoritmului;
      pentru prefix 1–6 se verifica suplimentar data/judet/an,
      iar pentru prefix 7/8/9 se verifica doar cifra de control),
      fie un CUI valid (2–10 cifre, fara zero la inceput, cu cifra de control corecta).
    </assert>
    
  </rule>
  

  <!-- Regula: rectif1/rectif2 → d_rec -->
  <rule context="/*">

    <let name="desc_drec"
         value="$schema//xs:attribute[@name='d_rec']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_r1"
         value="$schema//xs:attribute[@name='rectif1']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_r2"
         value="$schema//xs:attribute[@name='rectif2']/xs:annotation/xs:documentation[1]"/>

    <let name="r1" value="normalize-space(@rectif1)"/>
    <let name="r2" value="normalize-space(@rectif2)"/>
    <let name="drec" value="normalize-space(@d_rec)"/>

    <let name="isRect" value="($r1 = '1') or ($r2 = '1')"/>

    <let name="isValid"
         value="($isRect and $drec = '1')
               or (not($isRect) and $drec = '0')"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0003">
      [BR-D212-0003]
      Valoarea atributului
      <value-of select="if (normalize-space($desc_drec) != '') then $desc_drec else 'd_rec'"/>
      (d_rec)
      din elementul <value-of select="name(.)"/>
      trebuie să fie 1 dacă oricare dintre:

      <value-of select="if (normalize-space($desc_r1) != '') then $desc_r1 else 'rectif1'"/> (rectif1),
      <value-of select="if (normalize-space($desc_r2) != '') then $desc_r2 else 'rectif2'"/> (rectif2)

      are valoarea 1; în caz contrar, trebuie să fie 0.
    </assert>

  </rule>

  <!-- Regula: totalPlata_A = suma cifrelor care compun atributul cif -->
  <rule context="//@*[name(.) = 'totalPlata_A']">

    <let name="attName" value="name(.)"/>

    <let name="desc"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>

    <let name="totalPlataA" value="number(normalize-space(.))"/>

    <!-- IMPORTANT: cif este pe acelasi element (radacina), nu pe parinte generic -->
    <let name="cifRoot" value="normalize-space(ancestor::*[1]/@cif)"/>

    <let name="sumaCifreCif"
         value="sum(for $i in 1 to string-length($cifRoot)
                    return number(substring($cifRoot, $i, 1)))"/>

    <let name="isValid" value="$totalPlataA = $sumaCifreCif"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0004">
      [BR-D212-0004]
      <value-of select="if (normalize-space($desc) != '') then $desc else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie egala cu suma cifrelor care compun atributul 'cif'
      de pe elementul radacina.
    </assert>

  </rule>

  <!-- Regula: luna_r trebuie sa fie 12 -->
  <rule context="//@*[name(.) = 'luna_r']">

    <let name="attName" value="name(.)"/>
    <let name="desc"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>

    <let name="luna" value="number(normalize-space(.))"/>
    <let name="isValid" value="$luna = 12"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0005">
      [BR-D212-0005]
      <value-of select="if (normalize-space($desc) != '') then $desc else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa aiba valoarea 12.
    </assert>

  </rule>

  <!-- Regula: an_r trebuie sa fie 2026 -->
  <rule context="//@*[name(.) = 'an_r']">

    <let name="attName" value="name(.)"/>
    <let name="desc"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>

    <let name="an" value="number(normalize-space(.))"/>
    <let name="isValid" value="$an = 2026"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0006">
      [BR-D212-0006]
      <value-of select="if (normalize-space($desc) != '') then $desc else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      trebuie sa aiba valoarea 2026.
    </assert>

  </rule>

  <!-- Regula: bifa111 = 1 <=> elementul cap11 exista -->
  <rule context="//@*[name(.) = 'bifa111']">

    <let name="attName" value="name(.)"/>

    <let name="desc_bifa111"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="desc_cap11"
         value="$schema//xs:element[@name='cap11']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(.)"/>
    <let name="hasCap11" value="exists(../*[local-name() = 'cap11'])"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasCap11 )
               or ( $bifa != '1' and not($hasCap11) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0007">
      [BR-D212-0007]
      Atributul
      <value-of select="if (normalize-space($desc_bifa111) != '') then $desc_bifa111 else $attName"/>
      (<value-of select="$attName"/>)
      si elementul
      <value-of select="if (normalize-space($desc_cap11) != '') then $desc_cap11 else 'cap11'"/>
      (cap11)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa111) != '') then $desc_bifa111 else $attName"/>
      (<value-of select="$attName"/>)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_cap11) != '') then $desc_cap11 else 'cap11'"/>
      (cap11)
      trebuie sa existe,
      iar daca
      <value-of select="if (normalize-space($desc_cap11) != '') then $desc_cap11 else 'cap11'"/>
      (cap11)
      exista, atunci
      <value-of select="if (normalize-space($desc_bifa111) != '') then $desc_bifa111 else $attName"/>
      (<value-of select="$attName"/>)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- Regula: bifa112 = 1 <=> elementul cap12 exista -->
  <rule context="//@*[name(.) = 'bifa112']">

    <let name="attName" value="name(.)"/>

    <let name="desc_bifa"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="desc_cap"
         value="$schema//xs:element[@name = 'cap12']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(.)"/>
    <let name="hasCap" value="exists(../*[local-name() = 'cap12'])"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasCap )
               or ( $bifa != '1' and not($hasCap) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0008">
      [BR-D212-0008]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      si elementul
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap12'"/>
      (cap12)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap12'"/>
      (cap12)
      trebuie sa existe,
      iar daca
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap12'"/>
      (cap12)
      exista, atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- Regula: bifa121 = 1 <=> elementul cap14 exista -->
  <rule context="//@*[name(.) = 'bifa121']">

    <let name="attName" value="name(.)"/>

    <let name="desc_bifa"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="desc_cap"
         value="$schema//xs:element[@name = 'cap14']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(.)"/>
    <let name="hasCap" value="exists(../*[local-name() = 'cap14'])"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasCap )
               or ( $bifa != '1' and not($hasCap) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0009">
      [BR-D212-0009]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      si elementul
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap14'"/>
      (cap14)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap14'"/>
      (cap14)
      trebuie sa existe,
      iar daca
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap14'"/>
      (cap14)
      exista, atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- Regula: bifa19 = 1 <=> elementul cap19 exista -->
  <rule context="//@*[name(.) = 'bifa19']">

    <let name="attName" value="name(.)"/>

    <let name="desc_bifa"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="desc_cap"
         value="$schema//xs:element[@name = 'cap19']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(.)"/>
    <let name="hasCap" value="exists(../*[local-name() = 'cap19'])"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasCap )
               or ( $bifa != '1' and not($hasCap) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0010">
      [BR-D212-0010]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      si elementul
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap19'"/>
      (cap19)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap19'"/>
      (cap19)
      trebuie sa existe,
      iar daca
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap19'"/>
      (cap19)
      exista, atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- Regula: bifa23 = 1 <=> elementul cap23 exista -->
  <rule context="//@*[name(.) = 'bifa23']">

    <let name="attName" value="name(.)"/>

    <let name="desc_bifa"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>
    <let name="desc_cap"
         value="$schema//xs:element[@name = 'cap23']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(.)"/>
    <let name="hasCap" value="exists(../*[local-name() = 'cap23'])"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasCap )
               or ( $bifa != '1' and not($hasCap) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0011">
      [BR-D212-0011]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      si elementul
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap23'"/>
      (cap23)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap23'"/>
      (cap23)
      trebuie sa existe,
      iar daca
      <value-of select="if (normalize-space($desc_cap) != '') then $desc_cap else 'cap23'"/>
      (cap23)
      exista, atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else $attName"/>
      (<value-of select="$attName"/>)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

  <!-- ================================================================== -->
  <!-- Regula: cont_bancar trebuie sa aiba format IBAN Romania VALID      -->
  <!-- Validare completa: format + checksum ISO 13616 (mod 97)            -->
  <!-- ================================================================== -->
  <rule context="//@*[name(.) = 'cont_bancar']">

    <let name="attName" value="name(.)"/>

    <let name="desc"
         value="$schema//xs:attribute[@name = $attName]/xs:annotation/xs:documentation[1]"/>

    <let name="ibanRaw" value="normalize-space(.)"/>
    <let name="iban" value="upper-case(replace($ibanRaw, '\s+', ''))"/>
    <let name="ibanLen" value="string-length($iban)"/>

    <let name="hasRoIbanFormat"
         value="$ibanLen = 24
               and substring($iban, 1, 2) = 'RO'
               and matches(substring($iban, 3, 2), '^[0-9]{2}$')
               and matches(substring($iban, 5, 4), '^[A-Z]{4}$')
               and matches(substring($iban, 9, 16), '^[A-Z0-9]{16}$')"/>

    <let name="rearranged" value="concat(substring($iban, 5), substring($iban, 1, 4))"/>

    <let name="numericString"
         value="
           string-join(
             for $i in 1 to string-length($rearranged)
             return
               let $ch := substring($rearranged, $i, 1)
               return
                 if (matches($ch, '[0-9]')) then $ch
                 else string(string-to-codepoints($ch) - 55)
           , '')
         "/>

    <let name="seg1" value="substring($numericString, 1, 9)"/>
    <let name="rem1" value="xs:integer($seg1) mod 97"/>

    <let name="seg2" value="concat(string($rem1), substring($numericString, 10, 7))"/>
    <let name="rem2" value="if (string-length($numericString) gt 9) then xs:integer($seg2) mod 97 else $rem1"/>

    <let name="seg3" value="concat(string($rem2), substring($numericString, 17, 7))"/>
    <let name="rem3" value="if (string-length($numericString) gt 16) then xs:integer($seg3) mod 97 else $rem2"/>

    <let name="seg4" value="concat(string($rem3), substring($numericString, 24, 7))"/>
    <let name="rem4" value="if (string-length($numericString) gt 23) then xs:integer($seg4) mod 97 else $rem3"/>

    <let name="seg5" value="concat(string($rem4), substring($numericString, 31))"/>
    <let name="finalRemainder" value="if (string-length($numericString) gt 30) then xs:integer($seg5) mod 97 else $rem4"/>

    <let name="checksumOK" value="$hasRoIbanFormat and $finalRemainder = 1"/>

    <let name="isValidIban" value="$ibanLen = 0 or $checksumOK"/>

    <assert test="$isValidIban" flag="fatal" id="BR-D212-0012">
      [BR-D212-0012]
      <value-of select="if (normalize-space($desc) != '') then $desc else $attName"/>
      (<value-of select="$attName"/>)
      din elementul <value-of select="name(..)"/>
      , daca este completat,
      trebuie sa respecte formatul IBAN Romania valid:
      - Format: RO + 2 cifre control + 4 litere (cod banca) + 16 caractere alfanumerice
      - Lungime totala: 24 caractere
      - Cifra de control ISO 13616 (mod 97) trebuie sa fie corecta.

      Valoare introdusa: "<value-of select="$iban"/>"
      <value-of select="
        if ($hasRoIbanFormat and not($checksumOK))
        then concat(' (format OK, dar cifra de control incorecta - remainder: ', $finalRemainder, ')')
        else if (not($hasRoIbanFormat) and $ibanLen gt 0)
        then ' (format invalid)'
        else ''
      "/>
    </assert>

  </rule>

  <!-- Regula: bifa_optiune = 1  <=>  situatie_optiune este completat(ă) -->
  <!-- (mutat pe context de atribut ca sa nu se suprapuna cu alte reguli pe element) -->
  <rule context="//@bifa_optiune | //@situatie_optiune">

    <let name="desc_bifa"
         value="$schema//xs:attribute[@name='bifa_optiune']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_sit"
         value="$schema//xs:attribute[@name='situatie_optiune']/xs:annotation/xs:documentation[1]"/>

    <let name="bifa" value="normalize-space(../@bifa_optiune)"/>
    <let name="situatie" value="normalize-space(../@situatie_optiune)"/>

    <let name="hasSit" value="string-length($situatie) &gt; 0"/>

    <let name="isValid"
         value="( $bifa = '1' and $hasSit )
               or
               ( $bifa != '1' and not($hasSit) )"/>

    <assert test="$isValid" flag="fatal" id="BR-D212-0015">
      [BR-D212-0015]
      Atributul
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      si atributul
      <value-of select="if (normalize-space($desc_sit) != '') then $desc_sit else 'situatie_optiune'"/>
      (situatie_optiune)
      din elementul <value-of select="name(..)"/>
      trebuie sa fie corelate astfel:
      daca
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      are valoarea 1, atunci
      <value-of select="if (normalize-space($desc_sit) != '') then $desc_sit else 'situatie_optiune'"/>
      (situatie_optiune)
      trebuie sa fie completat(ă),
      iar daca
      <value-of select="if (normalize-space($desc_sit) != '') then $desc_sit else 'situatie_optiune'"/>
      (situatie_optiune)
      este completat(ă), atunci
      <value-of select="if (normalize-space($desc_bifa) != '') then $desc_bifa else 'bifa_optiune'"/>
      (bifa_optiune)
      trebuie sa aiba valoarea 1.
    </assert>

  </rule>

</pattern>
